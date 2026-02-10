---
title: 如何优雅的让 mihomo 和你的容器中的其他服务共存
abbrlink: 357b852e
categories:
  - [笔记, 教程]
tags:
  - 计算机网络
  - 科学上网
  - mihomo
  - linux
---


> **写在前面：** 在开始排障之前，必须承认：如果你追求的是工业级的稳定与极度简单的运维，最理性的方案其实是**“网络层解耦”**——将代理部署在前端路由器上，或运行在一个独立的旁路网关中。
>
> ## 🤓☝️
>
> 但是既然你点开了这篇文章，说明你和我一样，并不满足于通过增加硬件层级来规避问题，而是更愿意在单一宿主机的底层网络里去折腾。如果你觉得 “**弄清楚每一个数据包的去向**” 比 “**能用就行**” 更有意义，那么请继续往下看。

# 背景

在使用 tun 模式的情况下，所有容器中（有独立的虚拟网卡或者网桥，非宿主机）的服务都会都会无任何响应，curl 也会一直卡着。整个请求像失踪了一样。有去无回

```markdown
➜  ✗ curl 36.97.161.161:31115 -v
*   Trying 36.97.161.161:31115...
* Connected to 36.97.161.161 (36.97.161.161) port 31115
> GET / HTTP/1.1
> Host: 36.97.161.161:31115
> User-Agent: curl/8.7.1
> Accept: */*
>
* Request completely sent off
然后就卡住了，一直没有动静。。。。。。
```

# 原因

## 一些基础知识

在 Linux 系统中，实现网络流量转发、拦截和处理的核心工具主要分为两类：**路由系统**（包括路由规则与路由表）和 **Netfilter 框架**（如传统的 iptables 和现代的 nftables）。

### 路由系统 (Routing)

路由系统主要负责决策数据包的 “ 下一跳 ” 路径。也就是流量应该去往哪一张网卡

- **路由策略 (ip rule)**：决定流量匹配哪一张路由表。

```
> root@neko-dashboard:~# ip rule show
0:      from all lookup local
5000:   from all fwmark 0x100 lookup main
5210:   from all fwmark 0x80000/0xff0000 lookup main
5230:   from all fwmark 0x80000/0xff0000 lookup default
5250:   from all fwmark 0x80000/0xff0000 unreachable
5270:   from all lookup 52
9000:   from all iif docker0 goto 9010
9000:   from all iif tailscale0 goto 9010
9001:   from all to 198.18.0.0/30 lookup 2022
9002:   not from all dport 53 lookup main suppress_prefixlength 0
9002:   from all iif Meta goto 9010
9003:   not from all iif lo lookup 2022
9003:   from 0.0.0.0 iif lo lookup 2022
9003:   from 198.18.0.0/30 iif lo lookup 2022
9010:   from all nop
32766:  from all lookup main
32767:  from all lookup default
```

- **路由表 (ip route)**：定义具体的网段指向哪一个网络接口（dev）或下一跳 IP（via）。

```
> root@neko-dashboard:~# ip route show table 2022
1.0.0.0/8 via 198.18.0.2 dev Meta 
2.0.0.0/7 via 198.18.0.2 dev Meta 
4.0.0.0/6 via 198.18.0.2 dev Meta 
8.0.0.0/7 via 198.18.0.2 dev Meta
```

### nftables（数据包过滤与操作）

nftables 是 iptables 的继任者，它在内核空间提供了一个高性能的分类框架，用于对流量进行深度处理，例如：修改源/目标 IP（NAT）、打标记（Mark）、丢弃（Drop）或接受（Accept）特定报文。

```
> root@neko-dashboard:~# nft list ruleset
table ip filter {
        chain INPUT {
                type filter hook input priority filter; policy drop;
                 counter packets 64675 bytes 26245713 jump KUBE-ROUTER-INPUT
                counter packets 47826 bytes 20728410 jump KUBE-FIREWALL
                ct state new  counter packets 456 bytes 42562 jump KUBE-PROXY-FIREWALL
                 counter packets 47826 bytes 20728410 jump KUBE-NODEPORTS
                ct state new  counter packets 456 bytes 42562 jump KUBE-EXTERNAL-SERVICES
                 meta mark & 0x00020000 == 0x00020000 counter packets 9 bytes 540 accept
                counter packets 47817 bytes 20727870 jump ts-input
                counter packets 47213 bytes 20658630 jump ufw-before-logging-input
                counter packets 47213 bytes 20658630 jump ufw-before-input
                counter packets 160 bytes 17006 jump ufw-after-input
                counter packets 160 bytes 17006 jump ufw-after-logging-input
                counter packets 160 bytes 17006 jump ufw-reject-input
                counter packets 160 bytes 17006 jump ufw-track-input
        }
```

### 他们如何一起工作的

{% asset_img "Plpab4H1YonocAx9zSwcaMpfnTf.png" "" %}

## Mihomo 都做了什么

### 比如我们的配置是这样的

```yaml
tun:
  enable: true
  stack: mixed             
  auto-route: true         
  auto-redirect: true      
  auto-detect-interface: true
  
  dns-hijack:
    - "any:53"
    - "tcp://any:53"

  route-exclude-address:
    - 0.0.0.0/8
    - 10.0.0.0/8           # K3s 默认网段 10.42.0.0/16 和 10.43.0.0/16
    - 100.64.0.0/10
    - 127.0.0.0/8
    - 169.254.0.0/16
    - 172.16.0.0/12        # 涵盖 Docker 和 部分 K8s 插件网段
    - 192.168.0.0/16       # 内网网段
    - fc00::/7             # IPv6 本地地址

  exclude-interface:
    - docker0
    - tailscale0

  strict-route: true       
  mtu: 1500
```

### 在系统中都做了什么

Mihomo 的 tun 模式会创建一张虚拟网卡

```
> ip addr
......
49: Meta: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UNKNOWN group default qlen 500
    link/none 
    inet 198.18.0.1/30 brd 198.18.0.3 scope global Meta
       valid_lft forever preferred_lft forever
    inet6 fe80::da8:308:1d9b:ca79/64 scope link stable-privacy 
       valid_lft forever preferred_lft forever
```

并且会在路由表里面添加优先级为 90xx 的以下规则

> 具体规则根据配置文件类型可能不一样

```yaml
> ip rule
......
// tun 配置里面 exclude-interface 中的网卡会写在 9000 这里
9000:   from all iif docker0 goto 9010
9000:   from all iif tailscale0 goto 9010

// tun 网卡自己的地址段
9001:   from all to 198.18.0.0/30 lookup 2022

// dns 劫持进入 mihomo 处理
9002:   not from all dport 53 lookup main suppress_prefixlength 0

// 防止内部流量回环
9002:   from all iif Meta goto 9010

// 将除了回环网卡以外的所有网卡上面的流量都导向 2022 路由表
// 虽然能够高效的转发所有流量，但是问题也就刚好就出在这
9003:   not from all iif lo lookup 2022
9003:   from 0.0.0.0 iif lo lookup 2022
9003:   from 198.18.0.0/30 iif lo lookup 2022

// 正常放行，继续查询下一个规则
9010:   from all nop 
......
```

> 💡 **重要**
> 在 mihomo 创建的路由表里面 9003 的第一条规则 “not from all iif lo lookup 2022”
> not 会对 from all iif lo 这个匹配规则取反
> from all 就是对于任意来源 ip
> Iif lo 就是判断来源网卡是 lo
> 所以大意就是除了来源网卡是 lo 的，都会进入 2022 路由表

并且创建 2022 路由表

> 这里是根据你的配置文件中的 tun 下面的 route-exclude-address 来生成的
> 有些情况下这张路由表很碎，他就是等于 0.0.0.0/0 排除掉你指定的 exclude 的 ip-cidr

```
> ip route show table 2022
1.0.0.0/8 via 198.18.0.2 dev Meta 
......
200.0.0.0/5 via 198.18.0.2 dev Meta 
208.0.0.0/4 via 198.18.0.2 dev Meta 
224.0.0.0/3 via 198.18.0.2 dev Meta
```

并且在 nftables 里面创建一个新的 table

```python
table inet mihomo {
        //白名单，来自上面的 route-exclude-address
        set inet4_local_address_set {
                type ipv4_addr
                flags interval
                elements = { 10.42.0.0/24, 100.116.84.48,
                             127.0.0.0/8, 172.17.0.0/16,
                             172.21.0.0-172.26.255.255, 172.28.0.0/15,
                             192.168.3.0/24, 198.18.0.0/30 }
        }

        // 将所有 meta 网卡上面的流量导向 mihomo 自己的内核端口
        chain output {
                type nat hook output priority mangle; policy accept;
                oifname "Meta" meta nfproto ipv4 meta l4proto tcp counter packets 3950 bytes 237000 redirect to :43591 return
        }
        
        // 这里用来过滤和排除不需要经过代理的内容
        chain prerouting {
                type nat hook prerouting priority dstnat + 1; policy accept;
                iifname "Meta" counter packets 10 bytes 520 return
                iifname "tailscale0" counter packets 19440 bytes 1166400 return
                ip daddr { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16 } counter packets 69746 bytes 5700894 return
                ip6 daddr { fc00::/7 } counter packets 0 bytes 0 return
                ip saddr @inet4_local_address_set meta l4proto { tcp, udp } th dport 53 counter packets 3605 bytes 289933 dnat ip to 198.18.0.2
                ip daddr @inet4_local_address_set counter packets 0 bytes 0 return
                tcp option mptcp exists counter packets 0 bytes 0 drop
                meta nfproto ipv6 counter packets 0 bytes 0 rejec t with icmpv6 no-route
                meta nfproto ipv4 meta l4proto tcp counter packets 648 bytes 38880 redirect to :43591 return
        }
}
```

## k8s 都做了什么

k8s 不会修改路由表，但是会在 nftables 里面添加新的内容用来 NAT 等。

```python
table ip filter {
        chain FORWARD {
                type filter hook forward priority filter; policy drop;
                 counter packets 2452 bytes 594955 jump KUBE-ROUTER-FORWARD
                ct state new  counter packets 249 bytes 19703 jump KUBE-PROXY-FIREWALL
                 counter packets 249 bytes 19703 jump KUBE-FORWARD
                ct state new  counter packets 206 bytes 16967 jump KUBE-SERVICES
                ct state new  counter packets 206 bytes 16967 jump KUBE-EXTERNAL-SERVICES
                 meta mark & 0x00020000 == 0x00020000 counter packets 206 bytes 16967 accept
                 counter packets 0 bytes 0 jump FLANNEL-FWD
        }

        chain OUTPUT {
                type filter hook output priority filter; policy accept;
                 counter packets 64613 bytes 34520170 jump KUBE-ROUTER-OUTPUT
                counter packets 47749 bytes 20647115 jump KUBE-FIREWALL
                ct state new  counter packets 253 bytes 23098 jump KUBE-PROXY-FIREWALL
                ct state new  counter packets 253 bytes 23098 jump KUBE-SERVICES
                 meta mark & 0x00020000 == 0x00020000 counter packets 0 bytes 0 accept
        }
```

## 分析原因

所以，我们现在可以很容易地构思出来指向 pod 的流量是如何有进没有出的。

比如我们的网络是这样的：

宿主机的内网 ip 192.168.3.7 是 。

忽略防火墙。

有一个 http-server 部署在宿主机的 8100 端口上面。

k8s ingress 的 https 监听在 8443。

Ingress 里面暴露了一个服务是 uptime.neko-saiko.com。

上层有一个路由器，公网 ip 是 114.154.19.19。

客户端 ip 是 1.1.1.1，端口是 9090。

### 面向宿主机的服务

#### 进入路由器

外部（ip 是 1.1.1.1）发送请求 `curl 114.154.19.19:8100`。

请求进入找到路由器，路由器进行 NAT，将目标 ip 转换成 192.168.3.7。并且发送到宿主机。

#### 进入网卡

宿主机的网卡 eno2 收到请求，进入 nft 的 PREROUTING 链，按照优先级进行处理。

没有匹配到任何修改的规则，最后还是 192.168.3.7:8000。

经过 ip rule 的 local 表判断 3.7 就是自己 ，进入 nft 的 INPUT 链。

最后正确转发到 8000 端口上面的本地进程。

#### 回包

程序处理完产生了 源地址 192.168.3.7:8000 到 目标地址 1.1.1.1:9090，从网卡 lo（本地回环网卡） 出来。

进行 ip rule 的决策。匹配到了 main 里面的 `default via 192.168.3.1 dev eno2 proto dhcp src 192.168.3.7 metric 100` 规则。设置了出口网卡为 eno2。

进入 OUTPUT 链，进行处理。没有匹配到任何修改的规则，被放行。

进入 POSTROUTING 链，进行处理。没有匹配到任何修改的规则，被放行。

所以最后回包正确被发送出来，响应正确地回到了客户端

### 面向容器内的服务

#### 进入路由器

外部（ip 是 1.1.1.1）发送请求 `curl ``uptime.neko-saiko.com``:8443`。

请求进入找到路由器，路由器进行 NAT，将目标 ip 转换成 192.168.3.7。并且发送到宿主机。

#### 进入网卡

宿主机的网卡 eno2 收到请求，进入 nft 的 PREROUTING 链，按照优先级进行处理。

用端口（8443）匹配到了 ip nat 里面的 PREROUTING 的 chain

> 这里面还会通过 ip nat -> KUBE-SERVICES -> KUBE-EXT-EDNDUDH2C75GIR6O -> KUBE-MARK-MASQ
> 然后打上标记 0x4000

```
fib daddr type local counter packets 267551 bytes 21005917 jump CNI-HOSTPORT-DNAT
```

```
chain CNI-HOSTPORT-DNAT {
        ip protocol tcp  tcp dport { 9002, 8443 } counter packets 9 bytes 552 jump CNI-DN-0ffdff59029f5c5556a11
}

chain CNI-DN-0ffdff59029f5c5556a11 {
        ip saddr 10.42.0.0/24 tcp dport 9002 counter packets 0 bytes 0 jump CNI-HOSTPORT-SETMARK
        ip saddr 127.0.0.1 tcp dport 9002 counter packets 0 bytes 0 jump CNI-HOSTPORT-SETMARK
        tcp dport 9002 counter packets 0 bytes 0 dnat to 10.42.0.135:9002
        ip saddr 10.42.0.0/24 tcp dport 8443 counter packets 0 bytes 0 jump CNI-HOSTPORT-SETMARK
        ip saddr 127.0.0.1 tcp dport 8443 counter packets 6 bytes 360 jump CNI-HOSTPORT-SETMARK
        tcp dport 8443 counter packets 9 bytes 552 dnat to 10.42.0.135:8443
}
```

最后将请求 DNAT 成了 10.42.0.135:8443。后续再进行匹配的时候虽然目标 ip 地址变了，但是配置文件里面早已经排除了 `10.0.0.0/8` ，所以并不会造成影响。最后安全走出 nftables，进入路由判断。

经过 ip rule 的 local 表判断，匹配到规则，将出口网卡设置为 cni0

```
10.42.0.0/24 dev cni0 proto kernel scope link src 10.42.0.1
```

最后判断 cni0 不是宿主机，进入 FORWARD 链。

。。。。。。

k8s 正确处理。

#### 回包

> 这里不关心容器内和 k8s 如何处理和转发，直接跳到宿主机开始接管流量

容器内产生了 源地址 10.x.x.x:xxxx 回往 目标地址 1.1.1.1:9090 的回包，网卡是 cni0。

> 实际上是 veth+，但是他和 cni0 是从属关系，从操作系统的角度看这个包就是 cni0 发出的。

这个包首先从 cni0 进入宿主机，这对于宿主机来说是一个进入网卡而并非产出数据。

所以进入 PREROUTING 链，但是他的目标 IP 是外部 IP，在整个 PREROUTING 的阶段不会有什么额外的操作，维持原样。

进入 ip rule 阶段。这个时候因为目标 IP 是外部 IP，并不会经过 local 表的捕获，一直走到了 `9003:   not from all iif lo lookup 2022`。对于宿主机来说，这个包的 iif 是 cni0，所以会命中这个规则。进入 2022 表，最终走到 Meta 网卡。

> 💡 **重要**
> 这里的理想状态应该是直接走到到 32766 的 main 表，然后就正常出去了。但是被 Meta 网卡截获了。

进入 FORWARD 链，匹配到了规则，正确 accept。

```python
chain KUBE-NWPLCY-COMMON {
         ct state invalid counter packets 0 bytes 0 drop
         ct state related,established counter packets 35268 bytes 19926730 accept
        ip protocol icmp  icmp type echo-request counter packets 0 bytes 0 accept
        ip protocol icmp  icmp type destination-unreachable counter packets 0 bytes 0 accept
        ip protocol icmp  icmp type time-exceeded counter packets 0 bytes 0 accept
}
```

进入 POSTROUTING，没有被显式丢弃。

最后正确发往 Meta 网卡。但是对于 Meta 网卡来说，这是一个 TCP 的 SYN+ACK 回包。直接被丢弃。

> 💡 **重要**
> Mihomo 的 TUN 模式内置了一个完整的 TCP 协议栈。正常的 TCP 流程应该是 `SYN -> SYN-ACK -> ACK`。由于入站的 **SYN** 是直接通过 `eno2` 交给容器的，Mihomo 并没有看到第一个包。当 `Meta` 接口突然收到一个 `SYN-ACK`（Flags [S.]）时，Mihomo 的协议栈认为这是一个无来源的响应，根据 TCP 安全规范，它会直接在内存中丢弃这个包。
>
>> root@neko-dashboard:~# tcpdump -i Meta -n tcp port 8443
>> 19:52:43.450872 IP 192.168.3.7.8443 > 36.97.161.161.21972: Flags [S.], seq 3870760149, ack 863159411, win 64308, options [mss 1410,sackOK,TS val 1590509642 ecr 3894315492,nop,wscale 7], length 0
>>

所以最后整个请求有来无回

## 解决办法

### 直接排除整个网卡

既然我们知道了整个原因就是因为 mihomo 没有排除掉 cni0 等网卡的流量，那直接在 ip rule 里面提前将这些网卡排除不就好了。就像 `exclude-interface：tailscale` 会直接添加 `9000:   from all iif tailscale0 goto 9010` 跳过后面的 9003 规则导致去往 2022 一样。

你说的对。**但是：**

虽然所有从 cni0 发出的回包不会出问题了，但是同样的，所有的容器内的请求也不会前往 Meta 网卡了，就不会经过代理。如果你容器内的服务还有这方面的需求（比如是一个 tg bot，那就无法跟 tg 的 api 交互了），那明显不是一个很好的解决方案。

### 设置环境变量

Linux 有个环境变量是 http_proxy ，可以直接指定代理服务器。通常情况下都可以设置为 mihomo 的端口。

你说的也对。**但是：**

亲身的体验下来就是总有些不那么规范的项目，自己实现一些奇奇怪怪的网络请求，或者封装了某些不那么规范的第三方库。读不到环境变量。总归不是一个很通用的解决办法。

{% asset_img "F78wbHDckoGOSDxqW4ZcjIIwn5d.png" "" %}

### 更好的解决方法

最好情况下就是：

- 入站的请求，要给响应的请求，我们不走代理
- 从容器内单独向外访问的请求，我们走代理

但是问题来了，我们怎么能将它们分离开。毕竟对于计算机来说，他不知道什么流量是啥，只知道网卡上面有电流通过了。

这个时候，我们就可以参考防火墙的工作原理：

- 在 nftables 里面，给满足要求的请求打上标记并且开启追踪
- 在 ip rule 里面，添加一个优先级更高的，把这些满足要求的提前引导到正确的路由表

所以，我们就可以在 nftables 里面创建一个新的 table，然后在 PREROUTING 链进行处理

> 注意这里的 priority 要至少比 dstnat 要更低，保证在任何一个 accept 之前打上这个标记

```bash
MARK_ID="0x100"
IFACE_PUBLIC="eno2"
TABLE_NAME="k8s_bypass"

nft "add table inet $TABLE_NAME"
nft "add chain inet $TABLE_NAME prerouting { type filter hook prerouting priority -150; policy accept; }"

# 【入站标记】: 只要是从 eno2 进来的、找本机的、TCP 8443 的新连接，全部打标
nft "add rule inet $TABLE_NAME prerouting iifname \"$IFACE_PUBLIC\" fib daddr type local ct state new ct mark set $MARK_ID counter"
# 【回包还原】: 针对所有虚拟网桥(cni0 等等) 回来的包，还原标记
nft "add rule inet $TABLE_NAME prerouting iifname != \"$IFACE_PUBLIC\" ct mark $MARK_ID meta mark set ct mark counter"
```

并且创建新的 ip rule

> 注意这里的优先级至少要比 9000 小，至少在所有流量流向 2022 路由表之前要进行判断

```bash
ip rule add fwmark $MARK_ID pref 5000 lookup main
```

这样我们就实现了不仅能够正确代理容器内流量，还能保证外部访问的请求正确响应

{% asset_img "ET4ibQb6hosg7SxUi8yc7ln2nIg.png" "" %}

### 最好的解决办法

参考文章开头的那句话
