// 这里的 head_end 表示在 </head> 标签前插入
hexo.extend.injector.register('head_end', () => {
  // url_for 是 Hexo 的内置函数，会自动处理路径问题
  return `<link rel="stylesheet" href="/css/custom.css">`;
});