# Doro

从一张 Doro 虾动图开始，做成可以转着看的 3D 虾虾，又加了一只短腿小狗。

[打开网页](https://doro.yuxino.cn/)

选择虾虾、狗狗、蓝色呆猫或四足呆猫，拖动旋转，滚轮或双指缩放。可以暂停动画、回到正面、凑近看头部；虾虾还可以展开原始动图对照。

虾虾和狗狗使用同一颗 Doro 脑袋，保留完整三维几何、头发跟随与眨眼。虾身会回弹，小狗会颠着小短腿跑，没有尾巴。网页保留明亮的卡通配色、白脸、淡粉腮红、粉色头发和描线。头部参考为用户提供的原始动图，三维几何自行搭建。

小狗的胸腹和四条短腿连成完整轮廓，采用白色平涂与外缘描线。脚爪有圆润的平底，迈步时会带动身体轻轻压缩回弹；头部略微转向观看者。

头发、眼睛与腮红参照原始动图校准；脸和狗狗身体使用干净的白色，脸沿保留连续的黑色描线。模型和预览图的资源版本随内容自动更新。

蓝色呆猫是正常直立站姿；四足呆猫使用同款蓝色脑袋和四足猫身。两只均为根据参考图重建的静态模型，可以旋转、缩放和查看头部，播放按钮显示“静态”。脸部使用从参考图进行相机投影、再烘焙到曲面三维几何上的纹理，并非提取的原始游戏模型。造型参考：[官方 Kit T 随从外观](https://store.playstation.com/en-gb/product/EP0102-PPSA08035_00-COSTUMEAIR000016)。

## 本地运行

```sh
pnpm install --frozen-lockfile
pnpm dev
```

模型和图片位于 `public/assets/`。依赖版本已锁定，无外部字体或分析脚本。

## 发布到 Meow

正式地址为 https://doro.yuxino.cn/。先预留版本，再用该版本的 CDN 目录构建 `dist/` 并发布：

```sh
node /path/to/meow-release/dist/cli.js reserve --project doro --dir dist
node scripts/build-meow.mjs
node /path/to/meow-release/dist/cli.js release --project doro --dir dist
```

发布需要独立的 `MEOW_RELEASE_TOKEN` 和 OSS 配置，通过进程环境提供，不写入仓库。所有模型、图片、脚本和解码器直接从 `img.yuxino.cn` 的版本目录加载，不经过 Meow 页面服务转发。Meow 保留独立版本，可在控制台查看和回滚。加载过程只显示文字与进度条，不展示预览背景图。

## GitHub Pages 回退站

```sh
pnpm build:pages
```

将更新后的源文件与 `docs/` 一起提交到 `main`。Pages 从 `main` 的 `/docs` 发布；相对资源路径支持仓库子目录。

虾虾和狗狗的动画采用 112 帧、50 fps 的 2.24 秒循环。GLB 内含额外的闭合终点，网页按经过的时间播放。原始 Blender 工程单独交付，不依赖网页运行。
