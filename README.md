# Auto Equation Numbering for Obsidian

为 Markdown 显示公式自动写入 `\tag{n}`。

## 行为与控制面板

- 识别 `$$ ... $$` 显示公式，不处理行内公式 `$...$`。
- **右侧控制面板 (Sidebar)**：点击左侧功能区的“有序列表”图标，或者通过命令面板运行 `Open Equation Numbering control panel (Sidebar)`，可以打开右侧控制面板。
- **按文档独立控制编号**：默认情况下每个 MD 文档不启用编号更新。
  - 在控制面板中点击 **Enable Numbering** 开启或关闭（或者点击右下角状态栏的 **`🔢`** 按钮）。
  - 开启时会立即自动对当前文档的公式进行首次编号。
- **公式编号格式设置**：
  - 在控制面板的 **Numbering Format** 下拉框中，您可以设置当前笔记的公式编号类型：
    - `Default`：默认序号样式 `1`、`2`...
    - `A-*`：带字母前缀 `A-1`、`A-2`...
    - `2.*`：带小节点样式 `2.1`、`2.2`...
    - `2-*`：带括号样式 `(2-1)`、`(2-2)`...
    - `Custom...`：自定义输入格式，其中的 `*` 会被自动替换为公式序号。
- **手动更新编号 (Update Number)**：
  - 启用编号后，在右侧控制面板点击 **Update** 按钮（或运行 `Update Equation Numbers in current note` 命令），即可手动触发重新编号与文中引用更新。不会再根据打字频率自动更新。
- **右下角状态栏图标**：
  - 状态栏右下角只保留 `🔢` 图标。开启编号时图标完全显示，关闭编号时图标呈半透明灰色，可通过悬停查看状态或点击切换。

示例：

```markdown
$$
\hat{\boldsymbol{y}}_c = \boldsymbol{X}_c\hat{\boldsymbol{\beta}}
$$
```

会被改写为：

```markdown
$$
\hat{\boldsymbol{y}}_c = \boldsymbol{X}_c\hat{\boldsymbol{\beta}}
\tag{1}
$$
```

同一篇笔记中第二次出现完全相同的公式时，会得到 `\tag{1}`；若删除首次出现的公式，剩余公式会在下一次自动扫描时成为该等价类的首次出现位置。

## 公式引用自动更新

支持在文中的 Markdown 文本里动态引用公式编号并自动更新。

### 1. 声明公式标签
在显示的公式块内部加入 LaTeX 标准的 `\label{label_name}` 标签，例如：
```markdown
$$
y_i = \beta_0 + \sum_{j=1}^p \beta_j x_{ij} + \varepsilon_i
\label{eq:mlr}
$$
```

### 2. 在正文中引用
在正文中使用标准的 Markdown 链接语法引用该标签，链接地址为 `#标签名`，例如：
- `[式（2）](#eq:mlr)`
- `[公式(2)](#eq:mlr)`
- `[2](#eq:mlr)`
- 支持使用空括号作为占位符，首次生成时会自动填充：`[式（）](#eq:mlr)`

### 3. 自动更新效果
当公式编号由于插入新公式或重新排列而发生改变（例如式（2）变为式（5））时，运行 **Update Equation Numbers**，正文中的所有引用链接如 `[式（2）](#eq:mlr)` 将会自动同步更新为 `[式（5）](#eq:mlr)`。

## 安装与构建

1. 在此目录执行 `npm.cmd install`。
2. 执行 `npm.cmd run build`，生成 `main.js`。
3. 在 Vault 中创建 `.obsidian/plugins/auto-equation-numbering/`，并将构建产物
   `manifest.json` 与 `main.js` 复制到该目录（无需复制 `node_modules`）。
4. 在 Obsidian 的“社区插件”设置中启用 **Auto Equation Numbering**。

开发时执行 `npm.cmd run dev`；每次修改 TypeScript 后再次运行即可重新构建。

## 注意

- 插件会统一管理显示公式中的 `\tag{...}`，手工编号会被重写。
- “完全相同”以移除 `\tag{...}` 后的 LaTeX 内容为准，连续空白差异会被忽略。
- MathJax 的公式标签应放在 `$$ ... $$` 块内。对于复杂的 `aligned`、`cases` 等环境，插件会将标签放在显示公式结尾。
