#!/bin/sh
set -eu

REQUIRED_ARTIFACTS="out/main/index.js out/preload/index.js out/renderer/index.html"

for file in $REQUIRED_ARTIFACTS; do
  if [ ! -s "/app/$file" ]; then
    echo "[smoke] 构建产物缺失或为空: $file"
    exit 1
  fi
done

# 关键内容标记粗校验(压缩产物无法逐行检查,仅确认核心符号存在)
grep -q '"desktopPet"' "/app/out/preload/index.js" || {
  echo "[smoke] preload 产物缺少 desktopPet 桥标记"
  exit 1
}
grep -q 'electron' "/app/out/main/index.js" || {
  echo "[smoke] main 产物缺少 electron 引用"
  exit 1
}
grep -q '<div id="app"' "/app/out/renderer/index.html" || {
  echo "[smoke] renderer 产物缺少应用根节点"
  exit 1
}

echo "[smoke] 构建产物校验通过: main/preload/renderer 均存在且含核心标记"
