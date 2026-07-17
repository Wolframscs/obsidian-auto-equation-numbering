import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  ItemView,
  WorkspaceLeaf
} from "obsidian";

interface FileSettings {
  enabled: boolean;
  format?: string;
}

interface EquationNumberingSettings {
  reuseNumberForDuplicates: boolean;
  enabledFiles: Record<string, FileSettings | boolean>;
}

const DEFAULT_SETTINGS: EquationNumberingSettings = {
  reuseNumberForDuplicates: true,
  enabledFiles: {}
};

const DISPLAY_MATH_WITH_ANCHOR = /(?:<a\s+id="([^"]+)"[^>]*>[ \t]*<\/a>[ \t]*\n?)?(^|\n)([\t ]*)\$\$([\s\S]*?)\$\$/g;
const CODE_FENCE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const TAG = /\\tag\s*\{[^{}]*\}/g;

function getFormattedNumber(format: string, num: number): string {
  if (!format || format === "default") {
    return String(num);
  }
  
  if (format.includes("*")) {
    return format.replace(/\*/g, String(num));
  }
  
  return String(num);
}

/**
 * Removes equation tags and normalizes only insignificant whitespace. This is
 * deliberately conservative: two equations have the same number only when
 * their LaTex content is otherwise the same.
 */
function equationKey(body: string): string {
  return body
    .replace(TAG, "")
    .replace(/(?:%\s*)?\\label\s*\{[^{}]*\}/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\s+/g, " ");
}

function numberedBody(body: string, formattedNum: string): string {
  const withoutTag = body
    .replace(TAG, "")
    .replace(/\r\n/g, "\n")
    .trim();

  // Keep multi-line equations readable; MathJax accepts \tag on its own line.
  if (body.includes("\n")) {
    return `\n${withoutTag}\n\\tag{${formattedNum}}\n`;
  }

  return `${withoutTag}\\tag{${formattedNum}}`;
}

function renumberText(
  text: string,
  reuseNumberForDuplicates: boolean,
  format: string = "default"
): { text: string; equationCount: number; uniqueCount: number } {
  const seen = new Map<string, number>();
  const labelMap = new Map<string, string>();
  let nextNumber = 1;
  let equationCount = 0;

  // Do not touch examples inside fenced code blocks.
  const parts = text.split(CODE_FENCE);
  const transformed = parts.map((part, index) => {
    if (index % 2 === 1) return part;

    return part.replace(DISPLAY_MATH_WITH_ANCHOR, (full, existingAnchor: string, prefix: string, indent: string, body: string) => {
      const key = equationKey(body);
      if (!key) return full;

      equationCount += 1;
      let number = seen.get(key);
      if (number === undefined || !reuseNumberForDuplicates) {
        number = nextNumber;
        nextNumber += 1;
        if (reuseNumberForDuplicates) seen.set(key, number);
      }

      const formattedNum = getFormattedNumber(format, number);

      // Look for \label{label_name} or % \label{label_name} in equation body
      let newBody = body;
      const labelMatch = body.match(/(?:%\s*)?\\label\s*\{([^{}]+)\}/);
      let labelKey = "";
      if (labelMatch) {
        labelKey = labelMatch[1].trim();
        labelMap.set(labelKey, formattedNum);

        // If it doesn't start with '%', prepend '% ' to prevent MathJax rendering error in Obsidian
        if (!labelMatch[0].startsWith("%")) {
          newBody = body.replace(/\\label\s*\{([^{}]+)\}/g, `% \\label{$1}`);
        }
      }

      const newBodyAndTag = numberedBody(newBody, formattedNum);
      
      return `${prefix}${indent}$$${newBodyAndTag}$$`;
    });
  });

  let renumberedText = transformed.join("");

  // Scan and update references: [display text](#label_name)
  // Only replace inside non-code blocks.
  const partsForRefs = renumberedText.split(CODE_FENCE);
  const transformedRefs = partsForRefs.map((part, index) => {
    if (index % 2 === 1) return part;

    return part.replace(/\[([^\]]*)\]\(#([^)]+)\)/g, (match, displayText: string, labelKey: string) => {
      const trimmedLabel = labelKey.trim();
      if (labelMap.has(trimmedLabel)) {
        const formattedNum = labelMap.get(trimmedLabel)!;
        
        let cleanFormattedNum = formattedNum;
        if ((cleanFormattedNum.startsWith("(") && cleanFormattedNum.endsWith(")")) ||
            (cleanFormattedNum.startsWith("（") && cleanFormattedNum.endsWith("）"))) {
          cleanFormattedNum = cleanFormattedNum.substring(1, cleanFormattedNum.length - 1);
        }

        let updatedDisplay = displayText;
        if (/（\s*）/.test(displayText)) {
          updatedDisplay = displayText.replace(/（\s*）/, `（${cleanFormattedNum}）`);
        } else if (/\(\s*\)/.test(displayText)) {
          updatedDisplay = displayText.replace(/\(\s*\)/, `(${cleanFormattedNum})`);
        } else if (/（[^（）]+）/.test(displayText)) {
          updatedDisplay = displayText.replace(/（[^（）]+）/, `（${cleanFormattedNum}）`);
        } else if (/\([^()]+\)/.test(displayText)) {
          updatedDisplay = displayText.replace(/\([^()]+\)/, `(${cleanFormattedNum})`);
        } else if (/[A-Za-z0-9.\-_*]+/.test(displayText)) {
          updatedDisplay = displayText.replace(/[A-Za-z0-9.\-_*]+/, formattedNum);
        } else if (displayText.trim() === "" || displayText === "?") {
          updatedDisplay = formattedNum;
        }

        return `[${updatedDisplay}](#${labelKey})`;
      }
      return match;
    });
  });

  renumberedText = transformedRefs.join("");

  return {
    text: renumberedText,
    equationCount,
    uniqueCount: reuseNumberForDuplicates ? seen.size : equationCount
  };
}

export const VIEW_TYPE_EQUATION_NUMBERING = "equation-numbering-view";

export class EquationNumberingView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: AutoEquationNumberingPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_EQUATION_NUMBERING;
  }

  getDisplayText(): string {
    return "Equation Numbering";
  }

  getIcon(): string {
    return "list-ordered";
  }

  async onOpen(): Promise<void> {
    this.plugin.sidebarView = this;
    this.updateView();
  }

  async onClose(): Promise<void> {
    if (this.plugin.sidebarView === this) {
      this.plugin.sidebarView = null;
    }
  }

  updateView(): void {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("equation-numbering-sidebar");

    // Header
    const header = container.createDiv({ cls: "setting-item setting-item-header" });
    const headerInfo = header.createDiv("setting-item-info");
    headerInfo.createEl("h4", { text: "Equation Numbering" });

    const view = this.plugin.getActiveMarkdownView();
    if (!view || !view.file) {
      container.createEl("p", { 
        text: "Open a markdown note to manage numbering.", 
        cls: "setting-item-description"
      });
      return;
    }

    const path = view.file.path;
    const fileSettings = this.plugin.getFileSettings(path);
    const isEnabled = fileSettings.enabled;

    // Toggle Item
    const toggleItem = container.createDiv("setting-item");
    const toggleInfo = toggleItem.createDiv("setting-item-info");
    toggleInfo.createDiv({ cls: "setting-item-name", text: "Enable Numbering" });
    toggleInfo.createDiv({ cls: "setting-item-description", text: "Toggle numbering for this note" });
    
    const toggleControl = toggleItem.createDiv("setting-item-control");
    const toggleBtn = toggleControl.createEl("button", {
      text: isEnabled ? "On" : "Off",
      cls: isEnabled ? "mod-cta" : ""
    });
    toggleBtn.addEventListener("click", () => {
      this.plugin.toggleNumberingForActiveFile().then(() => {
        this.updateView();
      });
    });

    // Update Button Item
    const updateItem = container.createDiv("setting-item");
    const updateInfo = updateItem.createDiv("setting-item-info");
    updateInfo.createDiv({ cls: "setting-item-name", text: "Update Numbers" });
    updateInfo.createDiv({ cls: "setting-item-description", text: "Update equation tags and text references" });

    const updateControl = updateItem.createDiv("setting-item-control");
    const updateBtn = updateControl.createEl("button", {
      text: "Update",
      cls: isEnabled ? "mod-cta" : ""
    });
    if (!isEnabled) {
      updateBtn.setAttribute("disabled", "true");
      updateBtn.addClass("eqn-btn-disabled");
    }
    updateBtn.addEventListener("click", () => {
      void this.plugin.updateNumberingForActiveFile();
    });

    // Format Selector Item
    const formatItem = container.createDiv("setting-item");
    const formatInfo = formatItem.createDiv("setting-item-info");
    formatInfo.createDiv({ cls: "setting-item-name", text: "Numbering Format" });
    formatInfo.createDiv({ cls: "setting-item-description", text: "Select format style for equations" });

    const formatControl = formatItem.createDiv("setting-item-control");
    const formatSelect = formatControl.createEl("select", { cls: "dropdown" });
    
    const options = [
      { value: "default", text: "Default (1, 2...)" },
      { value: "A-*", text: "A-* (A-1, A-2...)" },
      { value: "2.*", text: "2.* (2.1, 2.2...)" },
      { value: "2-*", text: "2-* ((2-1), (2-2)...)" },
      { value: "custom", text: "Custom..." }
    ];

    const currentFormat = fileSettings.format || "default";
    const isCustom = !options.some(opt => opt.value === currentFormat) && currentFormat !== "default";

    options.forEach(opt => {
      const optionEl = formatSelect.createEl("option", {
        value: opt.value,
        text: opt.text
      });
      if (opt.value === currentFormat || (opt.value === "custom" && isCustom)) {
        optionEl.setAttribute("selected", "true");
      }
    });

    // Custom Input Container (rendered as setting item if selected)
    const customItem = container.createDiv("setting-item");
    if (isCustom) {
      customItem.show();
    } else {
      customItem.hide();
    }
    const customInfo = customItem.createDiv("setting-item-info");
    customInfo.createDiv({ cls: "setting-item-name", text: "Custom Pattern" });
    customInfo.createDiv({ cls: "setting-item-description", text: "Use * for the equation number" });

    const customControl = customItem.createDiv("setting-item-control");
    const customInput = customControl.createEl("input", {
      type: "text",
      value: isCustom ? currentFormat : "A-*",
      style: "width: 100%;"
    });

    formatSelect.addEventListener("change", () => {
      const val = formatSelect.value;
      const run = async () => {
        if (val === "custom") {
          customItem.show();
          const customVal = customInput.value || "A-*";
          await this.plugin.setFileFormat(path, customVal);
        } else {
          customItem.hide();
          await this.plugin.setFileFormat(path, val);
        }
        if (isEnabled) {
          await this.plugin.updateNumberingForActiveFile();
        }
      };
      void run();
    });

    customInput.addEventListener("input", () => {
      void this.plugin.setFileFormat(path, customInput.value);
    });

    customInput.addEventListener("change", () => {
      const run = async () => {
        if (isEnabled) {
          await this.plugin.updateNumberingForActiveFile();
        }
      };
      void run();
    });

    // Reuse duplicate equations toggle
    new Setting(container)
      .setName("Reuse first number for duplicate equations")
      .setDesc("When enabled, identical display equations in one note receive the number of their first occurrence.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.reuseNumberForDuplicates)
          .onChange(async (value) => {
            this.plugin.settings.reuseNumberForDuplicates = value;
            await this.plugin.saveSettings();
            if (isEnabled) {
              await this.plugin.updateNumberingForActiveFile();
            }
          })
      );
  }
}

export default class AutoEquationNumberingPlugin extends Plugin {
  settings: EquationNumberingSettings = DEFAULT_SETTINGS;
  private statusBarItem: HTMLElement;
  private applying = new Set<string>();
  sidebarView: EquationNumberingView | null = null;
  lastActiveMarkdownView: MarkdownView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new EquationNumberingSettingTab(this.app, this));

    // Register Right Sidebar View
    this.registerView(
      VIEW_TYPE_EQUATION_NUMBERING,
      (leaf) => new EquationNumberingView(leaf, this)
    );

    // Create status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass("equation-numbering-status-bar");
    this.statusBarItem.addEventListener("click", async () => {
      await this.toggleNumberingForActiveFile();
      if (this.sidebarView) {
        this.sidebarView.updateView();
      }
    });

    // Ribbon Icon to Toggle Right Sidebar
    this.addRibbonIcon("list-ordered", "Equation Numbering Control Panel", async () => {
      await this.activateView();
    });

    // Commands
    this.addCommand({
      id: "open-equation-numbering-sidebar",
      name: "Open Equation Numbering control panel (Sidebar)",
      callback: async () => {
        await this.activateView();
      }
    });

    this.addCommand({
      id: "toggle-equation-numbering",
      name: "Toggle Equation Numbering (Open/Close Number) for current note",
      editorCallback: async (editor, view) => {
        await this.toggleNumberingForActiveFile();
        if (this.sidebarView) {
          this.sidebarView.updateView();
        }
      }
    });

    this.addCommand({
      id: "update-equation-numbers",
      name: "Update Equation Numbers in current note",
      editorCallback: async (editor, view) => {
        await this.updateNumberingForActiveFile();
      }
    });

    this.addCommand({
      id: "renumber-vault",
      name: "Renumber display equations in all enabled Markdown notes",
      callback: async () => {
        await this.renumberVault();
      }
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.updateStatusBar();
        if (this.sidebarView) {
          this.sidebarView.updateView();
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (this.sidebarView) {
          this.sidebarView.updateView();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (this.settings.enabledFiles && this.settings.enabledFiles[oldPath]) {
          this.settings.enabledFiles[file.path] = this.settings.enabledFiles[oldPath];
          delete this.settings.enabledFiles[oldPath];
          await this.saveSettings();
          this.updateStatusBar();
          if (this.sidebarView) {
            this.sidebarView.updateView();
          }
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (this.settings.enabledFiles && this.settings.enabledFiles[file.path]) {
          delete this.settings.enabledFiles[file.path];
          await this.saveSettings();
          this.updateStatusBar();
          if (this.sidebarView) {
            this.sidebarView.updateView();
          }
        }
      })
    );

    this.app.workspace.onLayoutReady(() => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        this.lastActiveMarkdownView = activeView;
      }
      this.updateStatusBar();
    });
  }

  onunload(): void {
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<EquationNumberingSettings>);
    if (!this.settings.enabledFiles) {
      this.settings.enabledFiles = {};
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getActiveMarkdownView(): MarkdownView | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.lastActiveMarkdownView = activeView;
      return activeView;
    }
    
    if (this.lastActiveMarkdownView && this.lastActiveMarkdownView.leaf && this.lastActiveMarkdownView.leaf.workspace) {
      const leaves = this.app.workspace.getLeavesOfType("markdown");
      const stillOpen = leaves.some(l => l.view === this.lastActiveMarkdownView);
      if (stillOpen) {
        return this.lastActiveMarkdownView;
      }
    }
    
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    if (leaves.length > 0) {
      const view = leaves[0].view as MarkdownView;
      this.lastActiveMarkdownView = view;
      return view;
    }
    
    return null;
  }

  getFileSettings(path: string): FileSettings {
    if (!this.settings.enabledFiles) {
      this.settings.enabledFiles = {};
    }
    const setting = this.settings.enabledFiles[path];
    if (typeof setting === "boolean") {
      return { enabled: setting, format: "default" };
    }
    if (setting) {
      return {
        enabled: !!setting.enabled,
        format: setting.format || "default"
      };
    }
    return { enabled: false, format: "default" };
  }

  async setFileEnabled(path: string, enabled: boolean): Promise<void> {
    const current = this.getFileSettings(path);
    this.settings.enabledFiles[path] = {
      enabled,
      format: current.format
    };
    await this.saveSettings();
  }

  async setFileFormat(path: string, format: string): Promise<void> {
    const current = this.getFileSettings(path);
    this.settings.enabledFiles[path] = {
      enabled: current.enabled,
      format: format
    };
    await this.saveSettings();
  }

  async toggleNumberingForActiveFile(): Promise<void> {
    const view = this.getActiveMarkdownView();
    if (!view || !view.file) {
      new Notice("Open a Markdown note first.");
      return;
    }
    const path = view.file.path;
    const fileSettings = this.getFileSettings(path);
    const isCurrentlyEnabled = fileSettings.enabled;

    if (isCurrentlyEnabled) {
      await this.setFileEnabled(path, false);
      new Notice("Equation numbering disabled for this note.");
    } else {
      await this.setFileEnabled(path, true);
      new Notice("Equation numbering enabled (Open Number). Updating equations...");
      await this.renumberEditor(view.editor, view.file);
    }
    this.updateStatusBar();
  }

  async updateNumberingForActiveFile(): Promise<void> {
    const view = this.getActiveMarkdownView();
    if (!view || !view.file) {
      new Notice("Open a Markdown note first.");
      return;
    }
    const path = view.file.path;
    const fileSettings = this.getFileSettings(path);
    if (!fileSettings.enabled) {
      new Notice("Equation numbering is disabled for this note. Toggle it on first.");
      return;
    }
    await this.renumberEditor(view.editor, view.file);
    new Notice("Equation numbers updated.");
  }

  updateStatusBar(): void {
    const view = this.getActiveMarkdownView();
    if (!view || !view.file) {
      this.statusBarItem.setText("");
      this.statusBarItem.hide();
      return;
    }
    this.statusBarItem.show();
    const path = view.file.path;
    const fileSettings = this.getFileSettings(path);
    const isEnabled = fileSettings.enabled;
    
    // Only display the icon
    this.statusBarItem.setText("🔢");
    
    if (isEnabled) {
      this.statusBarItem.addClass("is-active");
      this.statusBarItem.removeClass("is-inactive");
      this.statusBarItem.setAttribute("title", "Equation numbering is enabled (Click to disable)");
    } else {
      this.statusBarItem.addClass("is-inactive");
      this.statusBarItem.removeClass("is-active");
      this.statusBarItem.setAttribute("title", "Equation numbering is disabled (Click to enable)");
    }
  }

  async renumberEditor(editor: Editor, file: TFile | null): Promise<void> {
    if (!file || this.applying.has(file.path)) return;

    const path = file.path;
    const fileSettings = this.getFileSettings(path);
    const format = fileSettings.format || "default";

    const original = editor.getValue();
    const result = renumberText(original, this.settings.reuseNumberForDuplicates, format);
    if (result.text === original) return;

    this.applying.add(file.path);
    try {
      const cursor = editor.getCursor();
      const scrollInfo = editor.getScrollInfo();

      editor.setValue(result.text);

      editor.setCursor(cursor);
      editor.scrollTo(scrollInfo.left, scrollInfo.top);
    } finally {
      window.setTimeout(() => this.applying.delete(file.path), 0);
    }
  }

  private async renumberVault(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    let changed = 0;

    for (const file of files) {
      const fileSettings = this.getFileSettings(file.path);
      if (!fileSettings.enabled) continue;

      const leaves = this.app.workspace.getLeavesOfType("markdown");
      const openView = leaves.find(l => (l.view as MarkdownView).file?.path === file.path)?.view as MarkdownView;
      if (openView) {
        const before = openView.editor.getValue();
        await this.renumberEditor(openView.editor, file);
        if (openView.editor.getValue() !== before) changed += 1;
        continue;
      }

      const before = await this.app.vault.read(file);
      const result = renumberText(before, this.settings.reuseNumberForDuplicates, fileSettings.format || "default");
      if (result.text !== before) {
        await this.app.vault.modify(file, result.text);
        changed += 1;
      }
    }

    new Notice(`Equation numbering updated in ${changed} note(s).`);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_EQUATION_NUMBERING);
    
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE_EQUATION_NUMBERING,
        active: true,
      });
    }
    
    await workspace.revealLeaf(leaf);
    if (this.sidebarView) {
      this.sidebarView.updateView();
    }
  }
}

class EquationNumberingSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AutoEquationNumberingPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Equation Numbering Settings")
      .setHeading();

    containerEl.createEl("p", {
      text: "Equation numbering is manual and managed per-document. Toggle numbering or change formatting in the right sidebar control panel.",
    });

    // Demo Container
    const demoContainer = containerEl.createDiv({ cls: "eqn-demo-container" });
    
    const headingSetting = new Setting(demoContainer)
      .setName("🎬 效果演示 (Effect Demonstration)")
      .setHeading();
    headingSetting.settingEl.addClass("eqn-demo-title");

    demoContainer.createEl("p", { 
      text: "了解 Auto Equation Numbering 的核心工作流与效果", 
      cls: "eqn-demo-subtitle" 
    });

    // Card 1: 公式自动追加 Tag
    const card1 = demoContainer.createDiv({ cls: "eqn-demo-card" });
    card1.createDiv({ cls: "eqn-demo-card-title", text: "1. 公式自动追加 Tag" });
    
    const wrapper1 = card1.createDiv({ cls: "eqn-demo-step-wrapper" });
    
    // Original block 1
    const originalBox1 = wrapper1.createDiv({ cls: "eqn-demo-step-box" });
    const originalHeader1 = originalBox1.createDiv({ cls: "eqn-demo-step-header" });
    originalHeader1.createDiv({ cls: "eqn-demo-step-label", text: "原始文本" });
    originalHeader1.createDiv({ cls: "eqn-demo-badge eqn-demo-badge-before", text: "BEFORE" });
    originalBox1.createEl("pre", { 
      cls: "eqn-demo-step-code", 
      text: "$$\n\\hat{\\boldsymbol{y}}_c = \\boldsymbol{X}_c\\hat{\\boldsymbol{\\beta}}\n$$" 
    });

    // Arrow 1
    const arrowBox1 = wrapper1.createDiv({ cls: "eqn-demo-arrow-box" });
    arrowBox1.createDiv({ cls: "eqn-demo-arrow-icon", text: "➡️" });

    // Updated block 1
    const updatedBox1 = wrapper1.createDiv({ cls: "eqn-demo-step-box" });
    const updatedHeader1 = updatedBox1.createDiv({ cls: "eqn-demo-step-header" });
    updatedHeader1.createDiv({ cls: "eqn-demo-step-label", text: "自动更新后" });
    updatedHeader1.createDiv({ cls: "eqn-demo-badge eqn-demo-badge-after", text: "AFTER" });
    
    const codeEl1 = updatedBox1.createEl("pre", { cls: "eqn-demo-step-code" });
    codeEl1.createSpan({ text: "$$\n\\hat{\\boldsymbol{y}}_c = \\boldsymbol{X}_c\\hat{\\boldsymbol{\\beta}}\n" });
    codeEl1.createSpan({ text: "\\tag{1}", cls: "eqn-demo-green-highlight" });
    codeEl1.createSpan({ text: "\n$$" });

    // Card 2: 交叉引用同步
    const card2 = demoContainer.createDiv({ cls: "eqn-demo-card" });
    card2.createDiv({ cls: "eqn-demo-card-title", text: "2. 交叉引用同步" });
    
    const wrapper2 = card2.createDiv({ cls: "eqn-demo-step-wrapper" });
    
    // Original block 2
    const originalBox2 = wrapper2.createDiv({ cls: "eqn-demo-step-box" });
    const originalHeader2 = originalBox2.createDiv({ cls: "eqn-demo-step-header" });
    originalHeader2.createDiv({ cls: "eqn-demo-step-label", text: "编辑中" });
    originalHeader2.createDiv({ cls: "eqn-demo-badge eqn-demo-badge-before", text: "BEFORE" });
    originalBox2.createEl("pre", { 
      cls: "eqn-demo-step-code", 
      text: "$$\ny_i = \\beta_0 + \\sum_{j=1}^p \\beta_j x_{ij} + \\varepsilon_i\n\\label{eq:mlr}\n$$\n\n如[式（）](#eq:mlr)所示，我们建立了多元线性回归模型。" 
    });

    // Arrow 2
    const arrowBox2 = wrapper2.createDiv({ cls: "eqn-demo-arrow-box" });
    arrowBox2.createDiv({ cls: "eqn-demo-arrow-icon", text: "➡️" });

    // Updated block 2
    const updatedBox2 = wrapper2.createDiv({ cls: "eqn-demo-step-box" });
    const updatedHeader2 = updatedBox2.createDiv({ cls: "eqn-demo-step-header" });
    updatedHeader2.createDiv({ cls: "eqn-demo-step-label", text: "更新后" });
    updatedHeader2.createDiv({ cls: "eqn-demo-badge eqn-demo-badge-after", text: "AFTER" });
    
    const codeEl2 = updatedBox2.createEl("pre", { cls: "eqn-demo-step-code" });
    codeEl2.createSpan({ text: "$$\ny_i = \\beta_0 + \\sum_{j=1}^p \\beta_j x_{ij} + \\varepsilon_i\n% \\label{eq:mlr}\n" });
    codeEl2.createSpan({ text: "\\tag{1}", cls: "eqn-demo-green-highlight" });
    codeEl2.createSpan({ text: "\n$$\n\n如" });
    codeEl2.createSpan({ text: "[式（1）](#eq:mlr)", cls: "eqn-demo-green-highlight" });
    codeEl2.createSpan({ text: "所示，我们建立了多元线性回归模型。" });

    const tipBox2 = card2.createDiv({ cls: "eqn-demo-tip" });
    tipBox2.createSpan({ text: "💡 提示：", cls: "eqn-demo-highlight" });
    tipBox2.createSpan({ text: "若在当前公式前插入其他公式导致其编号变为 " });
    tipBox2.createSpan({ text: "2", cls: "eqn-demo-highlight" });
    tipBox2.createSpan({ text: "，再次触发更新后，正文中的引用链接将自动同步更新为：" });
    tipBox2.createEl("code", { text: "[式（2）](#eq:mlr)" });
    tipBox2.createSpan({ text: "。" });
  }
}
