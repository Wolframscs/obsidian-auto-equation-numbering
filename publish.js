const fs = require('fs');
const path = require('path');
const readline = require('readline');

// GitHub repository info
const OWNER = 'Wolframscs';
const REPO = 'obsidian-auto-equation-numbering';

// Files to upload
const FILES_TO_UPLOAD = [
  { name: 'main.js', contentType: 'application/javascript' },
  { name: 'manifest.json', contentType: 'application/json' },
  { name: 'styles.css', contentType: 'text/css' }
];

async function main() {
  // 1. Read manifest.json to get version
  let manifest;
  try {
    const manifestPath = path.join(__dirname, 'manifest.json');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to read manifest.json:', err.message);
    process.exit(1);
  }

  const version = manifest.version;
  if (!version) {
    console.error('❌ Version not found in manifest.json');
    process.exit(1);
  }

  console.log(`\n📦 Preparing release for version: ${version}`);

  // 2. Verify files exist
  for (const file of FILES_TO_UPLOAD) {
    const filePath = path.join(__dirname, file.name);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Required file "${file.name}" does not exist in root folder. Run 'npm run build' first.`);
      process.exit(1);
    }
  }

  // 3. Get GitHub Token
  let token = process.env.GITHUB_TOKEN;
  if (!token) {
    token = await askQuestion('🔑 Enter your GitHub Personal Access Token (PAT): ');
  }

  if (!token || token.trim() === '') {
    console.error('❌ GitHub Token is required.');
    process.exit(1);
  }

  token = token.trim();

  try {
    // 4. Create Release
    console.log(`🚀 Creating GitHub release "${version}"...`);
    const releaseResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'obsidian-publisher'
      },
      body: JSON.stringify({
        tag_name: version,
        target_commitish: 'main',
        name: version,
        body: `Release version ${version} of Auto Equation Numbering.`,
        draft: false,
        prerelease: false
      })
    });

    const releaseData = await releaseResponse.json();

    if (!releaseResponse.ok) {
      // Check if release already exists
      if (releaseData.errors && releaseData.errors.some(e => e.code === 'already_exists')) {
        console.warn(`⚠️ Release "${version}" already exists. Trying to fetch the existing release...`);
        // Fetch existing release to get upload URL
        const getReleaseResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${version}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'obsidian-publisher'
          }
        });
        const getReleaseData = await getReleaseResponse.json();
        if (!getReleaseResponse.ok) {
          throw new Error(`Failed to retrieve existing release: ${getReleaseData.message}`);
        }
        await uploadAssets(getReleaseData.upload_url, token);
      } else {
        throw new Error(releaseData.message || 'Unknown error');
      }
    } else {
      console.log(`✅ Release created successfully: ${releaseData.html_url}`);
      await uploadAssets(releaseData.upload_url, token);
    }

  } catch (err) {
    console.error('❌ Error during release creation:', err.message);
    process.exit(1);
  }
}

async function uploadAssets(uploadUrlTemplate, token) {
  // Clean upload URL: remove "{?name,label}" from the end
  const baseUploadUrl = uploadUrlTemplate.replace(/\{[^}]+\}/, '');

  console.log('📤 Uploading assets...');

  for (const file of FILES_TO_UPLOAD) {
    const filePath = path.join(__dirname, file.name);
    const fileContent = fs.readFileSync(filePath);
    const uploadUrl = `${baseUploadUrl}?name=${file.name}`;

    console.log(`  Uploading ${file.name} (${fileContent.length} bytes)...`);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.contentType,
        'Content-Length': fileContent.length.toString(),
        'User-Agent': 'obsidian-publisher'
      },
      body: fileContent
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      if (uploadData.errors && uploadData.errors.some(e => e.code === 'already_exists')) {
        console.warn(`  ⚠️ Asset "${file.name}" already exists on this release. Skipping.`);
      } else {
        console.error(`  ❌ Failed to upload ${file.name}:`, uploadData.message || 'Unknown error');
      }
    } else {
      console.log(`  ✅ Uploaded ${file.name} successfully.`);
    }
  }

  console.log('\n🎉 Done! All assets processed successfully.');
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

main();
