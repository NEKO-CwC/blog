# --- 阶段一：构建环境 ---
FROM node:22-alpine AS builder

WORKDIR /app

# 先拷贝 package.json 以利用镜像层缓存
COPY package*.json ./

# 安装依赖（这会自动安装 hexo-theme-redefine）
RUN npm install

# 拷贝全量源码
COPY . .

# 执行 Hexo 生成命令
RUN npx hexo generate

# --- 阶段二：生产运行环境 ---
FROM nginx:alpine

# 将构建好的静态文件拷贝到 Nginx 默认目录
COPY --from=builder /app/public /usr/share/nginx/html

# (可选) 如果你有自定义的 nginx 配置，取消下面一行的注释
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]