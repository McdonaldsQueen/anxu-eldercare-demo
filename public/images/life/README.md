# 首页生活照片

这里的 JPG 是当前演示使用的真实摄影素材占位，来自 Pexels，并非安序智护服务对象或项目实拍。

## 替换方式

1. 将自己的照片放进此目录。建议宽 1000–1600px，单张压缩到 100–300KB，使用 JPG 或 WebP。
2. 打开 `src/data/lifePhotos.ts`。数组顺序就是照片流顺序。
3. 修改 `file` 文件名与 `alt` 真实画面描述；`format` 可选 `portrait`、`landscape`、`square`，控制展示宽度；`position` 为 CSS object-position，例如 `50% 65%`。
4. 保留文件名时也可以直接覆盖图片。重新执行 `npm run build`，刷新本地页面。

不要改两个循环组，也不要手动复制数组。组件会自动复制一组用于无缝衔接，并从辅助技术中隐藏重复照片。建议至少保留五张、混合横竖构图；单组最小宽度为视口宽度。

动画默认每轮 130 秒（手机 110 秒），参数位于 `src/styles/landing.css`。可暂停、悬停暂停；系统减少动态效果时关闭动画、显示全部照片，隐藏重复组。

## 当前素材来源

| 本地文件 | 摄影原始页面 |
| --- | --- |
| cooking-together.jpg | https://www.pexels.com/photo/elderly-couple-cooking-together-8769742/ |
| reading-at-home.jpg | https://www.pexels.com/photo/an-elderly-man-sitting-near-the-wooden-table-while-reading-newspaper-6975077/ |
| a-walk-outside.jpg | https://www.pexels.com/photo/elderly-man-walking-on-sidewalk-26780868/ |
| kitchen-conversation.jpg | https://www.pexels.com/photo/an-elderly-women-having-conversation-in-the-kitchen-6927890/ |
| a-quiet-afternoon.jpg | https://www.pexels.com/photo/elderly-man-reading-newspaper-on-urban-street-28961769/ |

素材使用条款：https://www.pexels.com/license/ 。后续替换为获授权的真实老人生活摄影，并相应更新本表。
