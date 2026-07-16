# Auto Equation Numbering for Obsidian

An Obsidian plugin that automatically numbers display equations (`$$ ... $$`) and keeps your equation references in sync.

[简体中文](#简体中文)

---

## Features

- **Automatic Equation Numbering**: Scans and adds `\tag{n}` to display equations (`$$ ... $$`) inside your notes.
- **Per-note Control**: Enable or disable equation numbering for specific notes.
- **Custom Formatting**: Customize your numbering style (e.g., standard `1, 2`, prefixed `A-1, A-2`, dotted `2.1, 2.2`, parenthesized `(2-1), (2-2)`, or any custom pattern using `*`).
- **Equation References Auto-Sync**: Detects LaTeX `\label{name}` inside your equations and updates markdown references (`[label](#name)`) automatically.
- **De-duplication**: Reuses the same number for identical equations to keep math notation clean and consistent.
- **No Side Effects**: Safely ignores inline equations (`$...$`) and code blocks (` ``` `).

---

## How to Use

### 1. Activating the Plugin
- Click the **Ordered List** icon on the ribbon, or run the command `Open Equation Numbering control panel (Sidebar)` to open the sidebar.
- Click the status bar icon **`🔢`** in the bottom right corner of the window to toggle numbering for the active note on or off.

### 2. Setting the Format
In the sidebar control panel:
- **Enable Numbering**: Turn numbering on for the current note.
- **Numbering Format**: Select a format style:
  - `Default`: `1`, `2`, `3`...
  - `A-*`: `A-1`, `A-2`, `A-3`...
  - `2.*`: `2.1`, `2.2`, `2.3`...
  - `2-*`: `(2-1)`, `(2-2)`, `(2-3)`...
  - `Custom...`: Type a custom pattern, where `*` will be replaced by the equation sequence number.

### 3. Inserting Equation Labels and References
To refer to an equation in your text:
1. Put a `\label{label_name}` tag inside the display equation block:
   ```markdown
   $$
   y_i = \beta_0 + \sum_{j=1}^p \beta_j x_{ij} + \varepsilon_i
   \label{eq:linear-model}
   $$
   ```
2. Reference it in your paragraph using a standard markdown link syntax with the `#` prefix:
   - `[Equation ()](#eq:linear-model)` (recommended: empty parenthesis will be filled automatically)
   - `[Eq (1)](#eq:linear-model)` (already filled, will be auto-updated)
   - `[1](#eq:linear-model)` (simple link with number)

### 4. Updating Numbers
Once you modify equations or rearrange their order, click the **Update** button in the sidebar control panel, or run the command `Update Equation Numbers in current note`. The tags `\tag{...}` and all text references will be synchronized instantly.

---

## Installation

### Manual Installation
1. Clone or download this repository.
2. In the repository folder, install dependencies and build the plugin:
   ```bash
   npm install
   npm run build
   ```
3. Create a folder named `obsidian-auto-equation-numbering` under your vault's plugin directory: `<vault>/.obsidian/plugins/`.
4. Copy `manifest.json` and `main.js` from the repository to that folder.
5. Open Obsidian, go to **Settings > Community plugins**, reload, and enable **Auto Equation Numbering**.

---

## Development

To build the plugin locally and auto-compile on changes:
```bash
npm run dev
```

---

## Important Notes

- **Tag Management**: The plugin automatically manages `\tag{...}` in your display equations. Manually written tags will be overwritten when updating.
- **Identical Equations**: Reusing numbers for duplicates is enabled by default. You can disable this in the plugin's global settings tab if you want unique numbers for every single equation block.
- **Label Handling**: Labels `\label{...}` in the equation body are automatically prefixed with `%` (e.g., `% \label{...}`) to prevent MathJax rendering issues in Obsidian.

---

<h2 id="简体中文">简体中文</h2>

Obsidian 自动公式编号插件，用于为 Markdown 显示公式自动写入 `\tag{n}`，并自动同步文档中的公式引用。

### 功能特点

- **自动公式编号**：识别 `$$ ... $$` 显示公式，自动在公式末尾添加 `\tag{n}`。不处理行内公式 `$...$`。
- **单文档控制**：可针对每个笔记文档单独开启或关闭编号更新。
- **丰富的编号格式**：支持多种内置格式（如 `1, 2`、`A-1, A-2`、`2.1, 2.2`、`(2-1), (2-2)`），并支持以 `*` 占位符自定义格式。
- **公式引用同步**：支持识别 LaTeX `\label{name}` 并动态更新正文中的 Markdown 引用链接 `[式（）](#name)`。
- **重复公式去重**：默认将完全相同的公式映射到同一个编号，使推导更一致。
- **安全过滤**：自动忽略代码块（如 ` ``` `）中的公式，避免误伤。

### 使用方法

1. **启用公式编号**
   - 点击左侧 Ribbon 栏的“有序列表”图标，或在命令面板中运行 `Open Equation Numbering control panel (Sidebar)` 即可打开右侧控制面板。
   - 也可以直接点击窗口右下角状态栏的 **`🔢`** 按钮，快速切换当前笔记的编号状态。
2. **选择编号格式**
   - 在控制面板的 **Numbering Format** 下拉菜单中选择适合的编号风格，或选择 `Custom...` 输入自定义模版（`*` 将被替换为公式序号）。
3. **声明标签与正文引用**
   - 在公式内部添加 `\label{your-label}`。
   - 在正文中使用标准链接格式进行引用，如 `[公式()](#your-label)`。空括号会在生成时被自动填充。
4. **手动更新**
   - 调整公式位置或插入新公式后，在控制面板点击 **Update** 按钮，或执行 `Update Equation Numbers in current note` 命令，全文的公式 `\tag` 和引用链接便会同步更新。

### 手动安装

1. 克隆或下载本仓库。
2. 在仓库根目录下运行：
   ```bash
   npm install
   npm run build
   ```
3. 在您的 Obsidian 库的 `.obsidian/plugins/` 目录下创建一个名为 `obsidian-auto-equation-numbering` 的新文件夹。
4. 将编译生成的 `main.js` 和 `manifest.json` 复制到该文件夹中。
5. 在 Obsidian 的“社区插件”设置中重新加载并启用 **Auto Equation Numbering**。
