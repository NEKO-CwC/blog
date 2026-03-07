---
title: 从飞书到 Hexo 的重度自动化
abbrlink: a8557e90
categories:
  - [日记, 分享]
tags:
  - 工程化
  - k8s
  - 计算机网络
  - Hexo
  - Redefine
  - Cloudflare
  - s3 存储
  - nginx
---


> 写在前面：本篇文章更多是一个记录自己折腾的过程，所以在这里面可能没有很细致的教程类的内容，而且你会看到很多没有必要的 “曲线救国”。包括但不限于
>
> - 有上行带宽不用，非要去部署到 S3 上面
> - 嫌薅来的 S3 连接质量不行，找了另一个 VPS 进行转发和代理
> - 用 k8s 去起一个博客
> - 写了 n 个脚本而且串在一起用
> - ci 里面写了好多 step 而且可维护性几乎为 0
>   项目代码大部分是 public 的，仓库[在这](https://github.com/NEKO-CwC/blog)
>   架构图如下：
>   {% asset_img "CrFpbuP6fomc4txVqr1cpDaqnGj.png" "" %}

## 引入：为了“偷懒”而进行的过度工程

作为一个习惯了云文档体验的开发者，我面临一个非常典型的“既要又要”的困境：

### 原始需求：优雅的创作，自由的表达

因为最近确实没什么事情干，就想着重新维护一下之前那个低可用性的 blog 网站~~（两年前的自己当时太菜了，啥也不会，几乎纯手动维护，最后也坚持不下去就扔了）~~，让他更**“企业级”：**

- **写作端：** 平时在**飞书文档**上面写东西。因为平时经常用飞书，而且觉得他长得好看。
- **展示端：** 我选择了 **Hexo** 配合 **Redefine** 主题。它足够轻量、高度可定制，而且长得好看。

### 核心痛点：孤岛与门槛

然而，理想与现实之间隔着三座大山：

- **平台孤岛：** 飞书的内容是闭环的，无法直接变成静态网页。
- **Markdown：** 虽然 Hexo 支持 Markdown，但是总是要去兼容 Hexo 的路径引用，图片资源引用之类的各种特性，还要二次处理，依然挺费劲。
- **运维负担：** 如果每次发布都要手动编译、手动上传图床、手动更新 K8s 镜像，那这套系统迟早还会因为之前一样的原因被抛弃掉。

### 我的方案：一套“过度工程”的自动化链路

为了让“在飞书写字”和“在 Hexo 发布”无缝衔接，我决定**用复杂的自动化逻辑换取极致的发布体验**。包括但不限于：

- **K8s + GitHub Actions** 搭建自动化的发布流水线；
- **Cloudflare R2** + **ngixn proxy cache** 构建低成本、高性能的图床；
- **N 个自研脚本** 让飞书文档到 Hexo 静态资源。

## 择良木而栖：为什么依然是 Hexo？

选择框架的时候倒是没有什么纠结，依然选择了之前就一直在用的 [Hexo](https://hexo.io/zh-cn/)。优点有很多：

- 老牌、社生态丰富
- 原生支持 Markdown 编译渲染成静态页面
- 高度自定义，还能插入并且注册独立运行的脚本做更多的处理

得益于 Hexo 强大的社区，里面有各式各样的主题，最后决定了 [Redefine](https://redefine.ohevan.com/)。因为他足够现代，足够简约好看。简单调整了[全局设置](https://redefine-docs.ohevan.com/zh/docs)就成了最后看到的样子

{% asset_img "SVDxbD4qmoLnKVxjyNccZTmTnLd.png" "" %}

## 自动化防腐：从手动编译到“一键下班”

现在每次修改博客文章内容后，都要自己在本地进行编译，然后推到 Dockhub 上面，又要在服务器上面拉下来重新启动。很麻烦。

所以我选择在 GitHub 创建一个 Public 的一个仓库，因为可以薅到每个月 2000 分钟免费的 action 时间。

并且写一个 [ci](https://github.com/NEKO-CwC/blog/blob/master/.github/workflows/deploy.yml)，来自动编译并且上传镜像，然后 ssh 执行 k8s 的 deployment 重启。

> 💡 **重要**
> 因为仓库是 Public 的，我已经将所有的敏感信息都在 action secrets 里面保存起来了。避免了所有的明文保存。

## 生产力桥梁：从飞书文档到 Hexo

因为平常飞书用的比较多，做文字记录也都在飞书文档，而且飞书文档原生支持 Markdown 的语法。就想着能不能找一个工具能够协助导出 Markdown 格式的文本，最后找到了 [feishu2md](https://github.com/Wsine/feishu2md)。

> 使用教程详见项目地址，这里不做赘述。
> 虽然这个项目已经停止维护了，但是现在存在的功能对于本来几乎就用 Markdown 语法写文档的我已经完全够用了。

但是在使用的过程中，很快就发现了问题：

- **导出结果不合预期**：feishu2md 导出的云文档会直接导出成一个单独的 md 文件，所有的资源都在相同路径的 `static` 文件夹下面，如下

```bash
├── static
│   ├── ET4ibQb6hosg7SxUi8yc7ln2nIg.png
│   ├── F78wbHDckoGOSDxqW4ZcjIIwn5d.png
│   └── Plpab4H1YonocAx9zSwcaMpfnTf.png
└── Xrp9drgTMo39Gtx6CchcZ9wZn4c.md
```

- **不方便归档**：导出的文件名是对应的 UUID 类似的随机字**符**
- **不够拿来就用**：对于 Hexo 来说，他的 md 文件里面少了 Front-matter 之类的博客文章 meta 信息，还要手动添加
- **不够方便**~~：还要手动移到仓库文件夹里面~~

这太不优雅了，为了自动化，就需要一个[脚本](https://github.com/NEKO-CwC/blog/tree/master/util/mdrefactor.py)来处理这些内容，直接从飞书文档链接到项目文件夹中。

## 社交闭环：添加 Gitalk 评论区

文章发布只是第一步，一个没有评论区的博客是没有灵魂的。在 Redefine 支持诸如 waline、gitalk 等评论系统。经过简单配置即可在文章末尾看到评论区。

{% asset_img "Tdr4bF0OTo1UCwxsZS4cOjvMn0f.png" "" %}

这里我们选择 Gitalk，

- 他会自动检测对应的仓库里面是否有 url 里面同名的 issue，然后把里面的 comment 进行同步。
- 相同的，发布评论的时候也会直接在 issue 创建新的 comment。
- 而且直接使用 GitHub 的 OAuth 即可登录，甚至节省了账号系统。

[Redefine](https://redefine-docs.ohevan.com/zh/docs/posts/comment) 的教程已经写得很好了，这里不再赘述。

但是对于每一个新的博客，我们都要手动去 issue 里面新建，这毫无疑问增加了我们的运维成本。所以我们需要一个[脚本](https://github.com/NEKO-CwC/blog/blob/master/ci/gitalk-init.js)，并且在 ci 里面添加执行

> 这个脚本就是自动读取文章 posts 文件夹中的 md 文件，然后自动关联 hexcode。issue 标题写文章标题。最后就能在 ci 里面自动创建。

关于 Gitalk 的配置遇到的问题文末有笔记。

## 资源进化：把沉重的素材丢给 R2 与 VPS 代理

随着图文内容的积累，我发现容器镜像的体积正在变得越来越大

> 如图为只差一个 blog 的前后镜像的区别

{% asset_img "DMyqb89gToBj4CxbMFGcyDSYnph.png" "" %}

因为我们的博客网站可能有很多的图片资源，这些图片资源一张就要 500KB，但是本来博客的内容 html 可能就只有 10+ KB。

- 比如包含 10 张图片，你的一个博客请求要 500KB * 10 + 10KB 约= 5M
- 但是不包含图片主要 10K

这几乎就是 5M / 10KB = 500 倍的上行带宽差距。

如果我们的博客网站同时有过多的并发请求，很容易占满上行带宽。所以我们有必要迁移到一些外部的云存储。

这里我们使用 CF 的 [R2](https://developers.cloudflare.com/r2/) 存储，作为互联网大善人 CF，他很慷慨的给了一些免费额度。计算下来对于小型访问量的博客已经完全够用了。

{% asset_img "IIPGb5gvCoeHxexQ066cwShYnOh.png" "" %}

我们只需要

- 在 hexo 编译之后执行[脚本](https://github.com/NEKO-CwC/blog/blob/master/scripts/cdn-replace.js)，替换所有 html 里面的应该代理的资源为 cdn 的 url
- 在打包镜像之前执行一个额外执行的[脚本](https://github.com/NEKO-CwC/blog/blob/master/scripts/hexo-deployer-r2.js)，来将所有的选中资源（大部分是图片视频之类的）上传到 R2 里面。然后在原本的仓库中删除这些资源。

> 不是一定要手搓，是因为找不到现成的插件

我们就能保证编译出来的镜像依然小，只有里面的博客文章 html。而且不影响本地的开发环境。

这看起来已经很好了不是吗。但是还是会有

### 问题：

- CF 虽然可以选择 Bucket 所在的地区为亚太，但是通常情况下解析出来的 ip 对于国内的连接效果并不好。甚至根本无法连接。~~（而且通常情况下 dns 甚至还要 400ms）~~

> 这里是我的 cf 的储存桶直连的效果
> {% asset_img "T7WYbMZvPoRjhWxGsmqcMLjynRd.png" "" %}

### 所以：

为了更好的效果，我们还可以找另一个 VPS ，上面部署一个 nginx proxy cache 来做转发。设置缓存，还能减少我们 R2 上面的 B 类请求。

> 这是配置了代理后
> {% asset_img "MJdibhz3woe5AExxuKccsPqTnpb.png" "" %}

## 结语：让复杂留在底层，让简洁回归创作

为了让博客网站回归他纯粹的样子，让我们专注于写博客，剩余的维护我们尽量不做。

我不再需要关心图片存哪、环境怎么配、或者 Issue 怎么建。现在，只需要在飞书写完文章，执行一下脚本导出并 `git push`，剩下的事情，就交给那些复杂的“过度工程”了。

## 资源链接

### 飞书文档转换和迁移[脚本](https://github.com/NEKO-CwC/blog/tree/master/util/mdrefactor.py)

脚本需要可以自取，用法是：

在一个有且仅能有一个 md 文件和一个名字为 static 的文件夹下运行

`python mdrefactor.py <work_dir> --dest <posts_dir>`

就会自动重构

- 重命名 md 文件和文件夹为一级标题
- 删除 md 文件中的一级标题，用 Front-matter 进行替换
- 替换 md 文件里的 `> [TIP]` 为 `> 💡 **重要`******
- 替换图片引用为 hexo 的 `{% asset_img "<url>" "<describe>" %}`
- 然后把 md 和素材复制到你的 dest 目录里面

为了让 hexo 自动识别这种同名 md 和同名文件夹，还需要修改 `_config.yml`

```yaml
post_asset_folder: true
```

### Nginx Proxy Cache

直接用 docker 起一个，然后挂个证书即可

```yaml
# 指定 DNS 解析器（必须，用于解析动态提取的变量域名）
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;

server {
    listen 28407 ssl;
    http2 on; # 开启 HTTP/2 以提升多资源加载效率
    server_name proxy.220181.xyz; # [替换] 你的代理域名

    # [替换] 证书实际存放路径
    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/cert.key;

    # SSL 安全增强配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:20m;
    ssl_session_timeout 10m;

    # 重要：禁止合并双斜杠，确保能正确解析 URL 中的 http:// 部分
    merge_slashes off;

    # 正则提取：$1=协议, $t_host=域名, $t_path=路径
    location ~* ^/(https?):/+(?P<t_host>[^/]+)(?P<t_path>/.*)?$ {
        
        # 防盗链逻辑：只允许特定域名引用（如博客）
        valid_referers server_names ~\.neko-cwc\.com; # [替换] 允许访问的来源域名正则
        if ($invalid_referer) {
            return 403;
        }

        # 构建最终目标 URL
        set $target_url "$1://$t_host$t_path$is_args$args";

        # 核心转发逻辑
        proxy_pass $target_url;
        proxy_http_version 1.1;
        proxy_set_header Connection ""; # 启用长连接支持
        
        # 头部透传与伪装
        proxy_set_header Host $t_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 开启 SNI 支持：解决目标站为 HTTPS 时的握手问题
        proxy_ssl_server_name on;
        proxy_ssl_name $t_host;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;

        # 高性能缓冲区调优（针对大文件处理）
        proxy_buffer_size 512k;
        proxy_buffers 16 512k;
        proxy_busy_buffers_size 1m;
        proxy_max_temp_file_size 0; # 禁用磁盘临时文件，强制内存处理
        proxy_request_buffering off; # 禁用请求缓冲，降低延迟

        # 缓存设置（使用全局 r2_cache）
        proxy_cache r2_cache;
        proxy_cache_valid 200 206 301 302 30d;
        proxy_cache_key $target_url;
        
        # 调试响应头
        add_header X-Cache-Status $upstream_cache_status always;
        add_header X-Target-URL $target_url always;
        add_header X-Via-Tun "sing-box" always;

        # 禁用针对代理流的 Gzip，避免二次压缩开销
        gzip off;

        # 浏览器缓存控制
        expires 30d;
    }

    # 兜底逻辑：非代理格式的请求直接返回 404
    location / {
        return 404;
    }
}
```

```yaml
user  nginx;
worker_processes auto;
error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    # 提高单进程连接上限，适用于高并发代理场景
    worker_connections 8192;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 基础性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    # [全局缓存配置] 10GB 硬盘缓存，10MB 内存索引
    # 对应下方 location 中的 proxy_cache r2_cache
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=r2_cache:10m max_size=10g inactive=7d use_temp_path=off;

    # 引入子配置文件
    include /etc/nginx/conf.d/*.conf;
}
```

然后记得在 `_config.yml` 里面修改，`cdn-replace.js` 会读取这个设置项进行 html 里面的资源替换

```yaml
cdn_url: https://proxy.220181.xyz:28407/https://cdn.blog.220181.xyz
```

### 更快的 r2 访问

即使我们上面将图床的 cdn 链接替换成了我们的 nginx proxy cache，但是这里面还会有一个瓶颈：

- **如果我们的 vps 访问 r2 也不够快怎么办**

CloudFlare 还有一个功能：**Warp****。**简单的说就是一个基于 WireGuard 协议的代理客户端。能通过隧道连接到 CF 的数据中心，根据你的地理位置自动调度优选节点，降低你访问 CF 的延迟。

- 如果想要白嫖使用 warp**+**，需要对应去 cf 注册一个 Zero Trust 组织（50 人内是免费的）

然后正常在 warp-cli 里面登录

{% asset_img "X0pOb32fAoOzXvxGmDxcZGfjn9c.png" "" %}

就可以使用了

{% asset_img "S4Cxb3iA0od7Uexhex4ciKo1nIg.png" "" %}

看到了这里面的 `warp=plus`，就代表你现在连接到这个域名就是通过 warp 的优选 ip 了。

**但是**默认情况下 warp 会作为一个**全局的透明代理**工作在你的系统里面，但是

- 如果你的服务器上面的网络环境比较复杂，再套一层 tun 可能会出现各种问题
- 或者你担心 tun 模式的虚拟网卡会影响你的服务器的网络性能

> 比如我服务器上面已经有了 tailscale 和 singbox 的 tun。而且还要经常作为跳板机进行流量转发的工作。

warp 可以通过设置作为一个 socks5 协议的代理节点工作在一个特定端口

{% asset_img "IHJrbqQuKogGeexwrq9cbj0vnqx.png" "" %}

{% asset_img "O2rcbwRMLow0nDxyYC4cxNn9nnb.png" "" %}

**但是**原生 nginx 无法直接将流量转发给 SOCKS5 代理，所以我们还需要一层中间级联代理。

可以用任意支持 socks5 协议的流量转发客户端进行出站节点的配置（比如我使用的就是 singbox），然后注册一个 mixed 或者 http 协议的入站节点。让 nginx 转发到这个端口或者直接依托于 tun 模式直接接管流量。

```json
{
// 无关配置省略
  "inbounds": [
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "127.0.0.1",
      "listen_port": 20080
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "socks",
      "tag": "warp-out",
      "server": "127.0.0.1",
      "server_port": 40000
    }
  ],
  "route": {
// 无关配置省略
}
```

## 踩坑指南

### 因为 Github 的 issue 有字数限制，很长的包含中文的 url 经过 encode 会变得很长很难看：

eg：一个名为 `如何优雅的让 mihomo 和你的容器中的其他服务共存` 的文章经过 encode 之后会变成 `%E5%A6%82%E4%BD%95%E4%BC%98%E9%9B%85%E7%9A%84%E8%AE%A9%20mihomo%20%E5%92%8C%E4%BD%A0%E7%9A%84%E5%AE%B9%E5%99%A8%E4%B8%AD%E7%9A%84%E5%85%B6%E4%BB%96%E6%9C%8D%E5%8A%A1%E5%85%B1%E5%AD%98`

- 这不仅在 issue 里面很难看，根本不知道是什么文章
- 而且长度也超过了限制，大多数情况根本无法正常创建 issue

所以可以使用 [hexo-abbrlink](https://github.com/ohroy/hexo-abbrlink) 这个插件进行处理。他能够根据每个文章的 meta 数据计算一个几乎不会重复的 hexcode，然后将这个 hexcode 作为 url 的参数进行编译。

### 前端页面因为浏览器的 CORS 限制，无法正确请求 GitHub 的 api，会被 Block 掉

{% asset_img "N9MfbhGxZodajhxCBL0cw8y6nRh.png" "" %}

我们可以选择公共的 github 代理~~（但是可用性不一定如何）~~或者在服务器上面部署一个 [cors-anywhere](https://hub.docker.com/r/testcab/cors-anywhere)。然后将 `_config.redefine.yml` 中的 `comment.config.gitalk.proxy` 改成我们经过代理后的 url

```yaml
gitalk:
      clientID: <your-client-id> 
      clientSecret: <your-client-secret> 
      repo: blog 
      owner: NEKO-CwC 
      proxy: https://cors.neko-dashboard.com:8443/https://github.com/login/oauth/access_token
```

> 💡 **重要**
> 用 k8s 的 ingress nginx 进行反向代理我们的 cors-anywhere 的时候，因为 Nginx Ingress Controller 默认分配的 Buffer 有限~~（甚至有点过小了）~~，导致请求的缓冲区溢出。
> Gitalk 的 OAuth 请求包含了较长的 `client_id`、`client_secret` 和 `code`。缓冲区溢出后其直接断开与后端 Pod 的连接，从而抛出 **502 Bad Gateway**

> 所以要添加 ingress 的 annotation

> ```yaml
> ```

annotations:

# 增加 Header 缓冲区

nginx.ingress.kubernetes.io/proxy-buffer-size: "128k"
nginx.ingress.kubernetes.io/proxy-buffers-number: "4"
nginx.ingress.kubernetes.io/proxy-busy-buffers-size: "256k"

```



```
