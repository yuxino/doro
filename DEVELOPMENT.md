# 开发与发布

[返回项目介绍](README.md)

## 本地开发

```sh
pnpm install --frozen-lockfile
pnpm dev
```

模型和图片位于 `public/assets/`，页面代码位于 `src/`。依赖版本已锁定。

```sh
pnpm build
pnpm preview
```

## 发布到 Meow

正式地址为 https://doro.yuxino.cn/。先预留版本，再用对应的 CDN 目录构建 `dist/` 并发布：

```sh
node /path/to/meow-release/dist/cli.js reserve --project doro --dir dist
node scripts/build-meow.mjs
node /path/to/meow-release/dist/cli.js release --project doro --dir dist
```

`/path/to/meow-release` 指向已构建的本地发布工具。发布需要独立的 `MEOW_RELEASE_TOKEN` 和 OSS 配置，通过进程环境提供，不写入仓库。

模型、图片、脚本和解码器从 `img.yuxino.cn` 的版本目录加载。Meow 保留独立版本，可在控制台查看和回滚。

## GitHub Pages

备用地址为 https://yuxino.github.io/doro/，从 `main` 的 `/docs` 发布。

独立构建备用站：

```sh
pnpm build:pages
```

将更新后的源文件与 `docs/` 一起提交。默认相对资源路径支持仓库子目录。

也可以在 Meow 发布并验证 CDN 资源后，将该次构建的 `dist/index.html` 同步到 `docs/index.html`，让备用站使用同一版本的 CDN 资源。不要混用不同版本的页面入口与资源。

## 语言与分享

首次访问根据浏览器语言／地区选择界面语言：中文语言（含繁体中文）或 CN/HK/MO/TW 地区设置默认中文，其余英文，不使用 IP 定位。手动选择优先并保存在本地；禁用本地存储时仍可切换，切换不会重新加载模型。

切换角色后地址栏同步更新，复制当前地址即可分享。蓝色呆猫使用 `?model=palico`，四足呆猫使用 `?model=siamese`；没有参数或参数无效时显示 Doro 虾虾。
