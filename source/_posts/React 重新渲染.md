---
title: React 重新渲染
---


# 一、引入

在前两天写代码的时候，写出来这样一段请求的代码

```typescript
function Component(props) {
    const [userName, setUserName] = useState("");
    // 我这里将异步请求放在了函数组件里面
    axios.get(`http://localhost:8080/getInfo?value=${value}`)  
    .then(res => {
        setUserName(res.data.userName);
        });
     return (
         <div>{userName}</div>
         )
    }
```

我的能这么干是因为本来 `useEffect` 只会在组件全部渲染完成后再执行里面的回调函数。但是我想提前执行请求获取数据，来缩短白屏时间。

但是最后的效果却是这样的

{% asset_img "VqAFbc0yoo1mZ5xsqVRc0mdPnZb.png" "" %}

最后知道原来组件中的 **state 改变**之后会触发组件的**重新渲染**，就是将函数组件内的所有代码重新执行一遍（体现在上面的代码中就是会再发送一遍请求，然后再次修改 state、然后再执行一遍请求代码，然后 state 又改变了......）

为了解决这个问题，我便开始研究 `React` 重新渲染的机制是怎样的

# 二、内容

## 1、什么是渲染

顾名思义，渲染就是将代码中的 DOM 元素展示在页面上，当然网页是响应式的。当用户操作元素，使其属性改变的时候，浏览器就需要将这些变化**重新展示**在页面上

在 react 的组件生命周期中，渲染会分为两个部分：初始渲染（**initial render**）和重新渲染（**re-render**）。

- 初始渲染：一般只会执行一次，当然就是你代码上面写了什么在最开始渲染出来就有什么，一般这里面的性能开支都是**必要的**，优化空间比较小，除非代码写的**特别烂**
- 重新渲染：可能会执行很多次，取决于你都需要在组件上面更新了什么东西，更新了多少。比如 useState、useContext 中的内容改变之类的。这里就有很大的优化空间了：都有什么需要更新、更新的时候要不要一起加载、对于那些特别大的组件要不要全部渲染......

> 💡 **重要**
> 浏览器操作 DOM 对象特别慢，因为每一次 DOM 改变都会产生两个过程

- 重排（Reflow（回流））：一旦有 DOM 对象改变了自己的位置或者大小等属性，页面上很多受影响的元素都需要重新计算自己的位置。虽然浏览器根据这个特性做出了自己的优化，会对很多 DOM 的修改操作暂存起来，等有需要或者当前这段代码执行完毕再应用。但是一旦有一段代码立即需要获取某个元素的属性，浏览器就不得不立即应用所有样式改变。在改动发生时，要重新经历页面渲染的整个流程，所以开销是很大的
- 重绘（Repaint）：当页面上只有元素的样式改变，但是并没有影响他的几何属性，就会跳过重新布局的这个环节，而直接应用新的样式。这个过程相比重排省去了布局和分层这两个环节，执行效率会更高
  但是不管优化的多么好，毕竟浏览器还是要和另一个线程上的渲染引擎通信，最后的执行效率肯定不会很高

## 2、渲染的时机

在一个组件里面，重新被渲染的条件只有四个

- 状态更改（useState）
- 父级组件重新渲染
- 上下文改变（useContext）
- 自定义 Hooks

> 这里的自定义 Hooks 特指那种调用了其他的 Hook 最终造成了上述条件中的前三个任意一个或者多个的情况

当上述任何一个条件被触发的时候，React 都会将这个状态改变带来的影响放入一个队列中暂时存储起来，找一个**恰当的时机**去应用这些变化

综上所述，我们能够得出一个结论，**只有组件内的任意“状态”改变（不包括 props）**，或者**父组件重新渲染，**才会触发组件的重新渲染，进而改变呈现出的效果

> 💡 **重要**
> 在许多文章中，都能看见说 “props 的改变会触发组件的重新渲染” ，但是在测试中发现说的并不准确

在大部分文章中主要有几个观点：

- 只要 props 改变，就会重新渲染
- 因为 React 使用**对象引用**比较来确定 props 是否发生了改变，所以即使对象或数组的值已更改，React 仍不会重新渲染组件

### 验证：props 的改变会不会触发组件的重新渲染

😕 观点一：props 的**值**改变就会触发重新渲染

```typescript
const Component= (props) => {
    return (
        <div>Component的value：{props.value}</div>
    )
}

function _App_() {
    _let value = 1;_
    useEffect(() => {
        _value = 2;_
    }, []);
    return (
        <Component value={value} />
    )
}
```

现在我们有如上代码，看起来子组件 Component 的 props 里的 value 在 App 挂载后改变了，最后呈现出来的 value 按照 props 更改然后重新渲染的观点来说，应该显示的是 2，但是实际上并不是这样

{% asset_img "IJm0bc7PSowGZvxppzkcwWdpnof.png" "" %}

所以：**props 的值改变不会触发重新渲染**

😕 观点二：props 的**引用**改变会触发重新渲染

还是上述代码，将 App 中的代码替换成这样。将 value 在组件挂载以后替换成另一个对象

```typescript
const Component= (props) => {
    return (
        <div>Component的value：{props.value.value}</div>
    )
}

function _App_() {
    const value1 = {value: 1};
    const value2 = {value: 2};
    let value = value1;
    _useEffect_(()=>{
        value = value2;
    }, []);
    return (
        <Component value={value} />
    )
}
```

这样 value 的引用改变了，按照上述观点，最后 Component 应该重新渲染了吧。可是依然还是这样

{% asset_img "UMOsbXPCIoEU1rxwugyc5NHGnCg.png" "" %}

所以：**props 的引用改变也不会触发重新渲染**

😕 之所以有时父组件中传递下来的 props 改变时子组件也发生了变化，是因为 props 中有父组件中传递下来的 state 改变，导致父组件重新运行函数组件整体，最后重新 return 了子组件，导致子组件也重新渲染。

所以，**props 的改变并不会影响组件的状态，只有任意状态改变导致的重新渲染才会导致页面上的内容变化**

> 使用 useMemo 之类的其他 hooks 暂时并不在此版块讨论范围

总结下来：影响重新渲染的时机的唯一因素，**状态改变**

> 这里引用颜佬对于这种机制的另一个理解：
> `宏观来说用户有交互就得响应，响应事实上可以理解为重新渲染。用户交互其一种结果在react中体现就是状态改变，当然如果用户想强制重新渲染完全可以调动react重新渲染`

## 3、渲染的原理

知道了组件都什么时候开始渲染，现在我们来研究一下组件重新渲染的时候都经历了什么

### 类组件的生命周期

一个完整的 React **类组件**会经历以下生命周期

{% asset_img "TnK3brJHLo9iGqxo5z7cFCflnZe.png" "" %}

> 现在的类组件应用越来越少了，已经逐渐被更加灵活的函数式组件替代。
> 如果有兴趣的话，可以去自行找资料了解一下，这里附上一篇我觉得讲得不错的文章：
> [React Component Lifecycle Methods – Explained with Examples](https://www.freecodecamp.org/news/react-component-lifecycle-methods/)

### 函数组件的生命周期

相比于类组件，函数组件（Function Component）是更彻底的**状态驱动**，甚至没有类组件（Class Component）生命周期的概念，只有一个状态，而 React 负责同步到 DOM。

下例是一个简化版的组件，功能很简单，仅仅实现了展示一个 div 中的 value

```typescript
function Component(props) {
    console.log("Component 渲染");
    const staticValue = 1;
    const containerRef = useRef(null);
    const [value, setValue] = useState("");
    
    useEffect(()=>{
        console.log("useEffect 开始执行");
        setValue("otherValue");
        })
        return ()=>{}
    }
    
    return (
        <div ref={containerRef}>{value}</div>
    )
```

参照类组件图表中的三个阶段和时机，现在让我们看看这个代码运行的时候都发生了什么

#### 挂载时：

**render 阶段：**

当组件首次运行，准备渲染时，React 会为这个组件创建一个新的 `Fiber` 节点，这个 Fiber 节点一般包含了元素的信息、该元素的更新操作队列、类型等等。在上述例子中，创建的 Fiber 对象数据结构大概如下

> 感谢颜佬，最后在 React 的源码里面找到了 Fiber 最后定义出来的数据结构

```typescript
_// Fiber 表示需要完成或已完成的组件上的工作。每个组件可能有多个 Fiber。

export type Fiber = {
  // 标记，用于标识 Fiber 的类型。
  tag: WorkTag, // 在这个例子中此属性为tag: WorkTag.FunctionComponent

  // 此子元素的唯一标识符。
  key: null | string,

  // 用于保留此子元素在协调过程中的身份的 element.type 的值。
  elementType: any, // Component

  // 与此 Fiber 相关联的已解析函数/类。
  type: any, // Component

  // 与此 Fiber 相关联的本地状态。
  stateNode: any, // null

  // 处理完当前 Fiber 后要返回的 Fiber。
  // 实际上这就是父级，但可能会有多个父级（两个），所以这仅是我们当前处理的内容的父级。
  // 从概念上讲，这类似于堆栈帧的返回地址。
  return: Fiber | null, // null 

  // 单链表树结构。
  child: Fiber | null, // null
  sibling: Fiber | null, // null
  index: number, // 0

  // 最后用于附加此节点的引用。
  // 我会避免添加一个 owner 字段用于 prod，并将其模拟为函数。
  ref:
    | null
    | (((handle: mixed) => void) & {_stringRef: ?string, ...})
    | RefObject, // containerRef

  refCleanup: null | (() => void), // null

  // 输入是用于处理此 Fiber 的数据。参数。Props。
  pendingProps: any, // 一旦我们重载了标记，这个类型将更具体。
  memoizedProps: any, // 用于创建输出的 props。

  // 状态更新和回调的队列。
  updateQueue: mixed, // null

  // 用于创建输出的状态
  memoizedState: any, // ["otherValue", setState]

  // 此 Fiber 的依赖项（上下文、事件），如果有的话
  dependencies: Dependencies | null,

  // 描述 Fiber 及其子树属性的位字段。例如，
  // ConcurrentMode 标志指示子树是否应该默认为异步。
  // 当创建 Fiber 时，它继承其父级的模式。附加的标志可以在创建时设置，
  // 但在此后，值应该在 Fiber 生命周期中保持不变，特别是在创建其子 Fiber 之前。
  mode: TypeOfMode, // TypeOfMode.NoMode

  // 效果
  flags: Flags, // Flags.NoFlags
  subtreeFlags: Flags, // Flags.NoFlags
  deletions: Array<Fiber> | null, // null

  lanes: Lanes, // NoLanes
  childLanes: Lanes, // NoLanes

  // 这是一个经过池化的 Fiber 版本。每个被更新的 Fiber 最终都会有一个配对。
  // 如果需要，有时我们可以清理掉一些配对以节省内存。
  alternate: Fiber | null, // null

  // 用于当前更新的渲染此 Fiber 及其后代所花费的时间。
  // 这告诉我们树在利用 sCU 进行记忆化方面的效果如何。
  // 每次渲染时将其重置为 0，仅在我们不进行回退时更新。
  // 仅在启用 enableProfilerTimer 标志时设置此字段。
  actualDuration?: number,

  // 如果 Fiber 当前处于“渲染”阶段活动中，
  // 这标记了工作开始的时间。
  // 仅在启用 enableProfilerTimer 标志时设置此字段。
  actualStartTime?: number,

  // 此 Fiber 的最近渲染时间的持续时间。
  // 在我们为记忆化目的进行回退时，此值不会更新。
  // 仅在启用 enableProfilerTimer 标志时设置此字段。
  selfBaseDuration?: number,

  // 所有后代 Fiber 的基本时间总和。
  // 此值在“完成”阶段向上传播。
  // 仅在启用 enableProfilerTimer 标志时设置此字段。
  treeBaseDuration?: number,

  // 用于验证 hooks 的顺序在渲染之间不会改变。
  _debugHookTypes?: Array<HookType> | null,

  // 下面是一些开发环境下的调试相关字段
  _debugInfo?: ReactDebugInfo | null,
  _debugOwner?: Fiber | null,
  _debugIsCurrentlyTiming?: boolean,
  _debugNeedsRemount?: boolean,
};
_
```

对于 `非Hooks` 语句或者变量来说，就是正常执行，变量有着自己的内存地址和值，在后面使用都和普通的 js 变量无异、语句有着自己的执行结果。

```typescript
console.log("Component render")
const staticValue = 1
```

对于每个 useState 和 useRef 等 `Hooks变量`，React 会在这个 Fiber 节点上记录相应的状态和引用。这些记录会与组件的类型和标识符（通常是文件位置或是组件的 key 属性）关联起来，以便于 React 可以追踪。在上述例子中 Hooks 是这样创建的。

> React 对于每一个 Hook 都会创建一个 Hook 对象，这个对象里面通常包含状态和**其他相关信息（特指指向下一个 Hook 链的内存引用）**。但是现在的 Hook 对象的源码并未公布，以下均为经过 ` GPT 的` **推测** `出的` Hook 结构

比如对于 useEffect 就会这样存储

```typescript
const useEffectHook = {
  // 标记为副作用的hook
  tag: 'Effect', // 注意：实际React内部使用数字枚举而非字符串
  // 副作用执行函数及清理函数
  create: function() {
    console.log("useEffect 开始执行");
    setValue("otherValue");
    // 返回的函数为清理函数，本例中未定义
    return function cleanup() {
      // 清理逻辑，本例中省略
    };
  },
  // 依赖数组，用于确定副作用是否需要重新执行
  deps: null, // 本例未指定依赖，所以为null
  // 链接到下一个hook，如果有的话
  next: {
      // useState相关的对象内容
      },
  // 副作用的调度优先级，React内部使用，根据执行时机不同有所不同
  priority: null, // 简化表示，实际上React根据执行时机和优先级设置
  // 副作用的唯一标识，用于优化
  key: null, // 简化表示，用于跟踪副作用的唯一性
  // 更多内部管理副作用的属性，如effect标签等
  // effectTag: SideEffectTag, // 实际React中用于区分副作用类型和执行时机的标签
};
```

如果遇见了 `return`，会开始构建 DOM 节点。React 会将 jsx 语法的元素进行 babel 解析，然后调用 React.createElement 去构建**虚拟 DOM 树**、然后再把虚拟 DOM 树和实际的 DOM 树做对比（Diff），查询出区别，然后进行操作。

> 对于 Diff 算法的简要概述

> 传统 Diff 算法：
> 对于旧树上的点 A 来说，它要和新树上的所有点比较，复杂度为 O(n)，然后如果点 A 在新树上没找到的话，点 A 会被删掉，然后遍历新树上的所有点找到一个去填空，复杂度增加为了 O(n^2)，这样的操作会在旧树上的每个点进行，最终复杂度为 O(n^3)。最终找到**最小的**编辑次数
> {% asset_img "ZsHLbNr30oLHcXx7PjGc4PMGnWe.png" "" %}
>
> React 的 Diff 算法：
> 但是在实际的 DOM 树中，那种跨层级的元素替换或者移动的情况还是特别少的，毕竟每个组件都有自己的 layout，把不属于这个组件中的元素替换进来无论是页面布局还是代码实现都少之又少。所以 React 非常聪明的把原来的 Diff 算法中跨层级比较的这个操作删除，只保留同层级下的比较。算法就变成了**深度优先算法**，复杂度就变为了 O(n)，但是最终的编辑次数却**不是最小的**
> {% asset_img "FniybZOxuoeI5gx68c8cdFEonDf.jpg" "" %}
> 这样在面临树中节点被替换成其他节点的时候，React 会非常简单粗暴的把这一整个节点删除，然后构建完全新的节点。即使组件的类是相同的，创建出来的数据结构也非常类似，只有里面的值不同，依然会将原来的树全部删除，然后再去构建一颗新的。虽然这样听起来可能很费时间和效率，编辑次数也大大增加，但是这却是 React 算法工程师对于效率与实用性的一种**折中**，虽然可能编辑次数不是最少的，但是相比于算法上面耗费的大量时间，直接让浏览器对 DOM 进行操作的性价比更高了一点

**pre-commit 阶段：**

因为现在在页面上面并没有 DOM 可供操作，首次渲染也不需要继承什么属性，所以首次挂载的时候并没有这个阶段。

**commit 阶段：**

因为这是首次渲染，实际 DOM 树是空树，所以会执行 `树级别` 的更新，创建真实的 DOM 节点。

直接向浏览器提交 DOM 结构进行渲染

> tips：每个组件的 Fiber 节点在整个页面周期里面都是稳定的，即使重新渲染，依然会查找到相同的节点位置

#### 更新时：

当用户操作促使代码中中使用了 setState 等 Hooks 对组件的状态进行更改的时候，会产生一个 `更新对象`（里面包含了更新产生的变化和优先级等）。组件就开始更新了

**render 阶段（计算更新内容）：**

将 `更新对象` 插入到 Fiber 节点的更新队列中，然后对当前的更新对象产生的影响进行评估，如果这个更新还涉及到了更多的状态改变，会将他们都丢进更新队列中（但是每一个更新操作都是有优先级的，所以如果有更重要的任务，会将更新推迟）。

```
   Fiber架构执行完更新代码以后，会根据最后的评估结果生成一个新的虚拟DOM树，因为是重新渲染，所以会执行`组件级别`的更新：将这个虚拟DOM树和现有的DOM树通过`diff`算法作对比，查询出来需要更新的部分
```

> 颜佬（reply to）：
> react 的虚拟 dom 其实采用的双缓存机制，像一个开关，当新的虚拟 dom 树构建好直接切换到新的虚拟 dom 树。那么怎么把这个新的虚拟 dom 树更有效率的渲染到页面上呢？很简单，前面说到 fiber 嘛，react 相当于通过 jsx 来构建 fiber 树嘛，jsx 上有 props 和 children。现有的 fiber 树每一个节点上有 oldProps，oldChildren，构建新 fiber 树时会对比不同给特定的节点打上标记（flags），然后切换要渲染时候直接根据有 flags 的节点进行渲染。整个过程中只有一个地方有对比，jsx 构建新的 fiber 树时，diff 算法正是用在这个阶段。
> 你可以把 fiber 理解为虚拟 dom，如果你想说不是说虚拟 dom 和真实 dom 对比嘛？那你就可以理解现有的 fiber 树为页面上渲染的 dom，而 jsx 为虚拟 dom。而要构建的为新 fiber 树

**pre-commit 阶段（准备更新条件）：**

```
  检查出来被这个变化影响的组件后，先获取这个组件中在window中需要继承的状态（例如滚动位置），并且将更新对象中的变化应用在组件上。
```

**commit 阶段（执行更新，展示在界面上）：**

```
   最后将组件重新渲染，对于函数组件来说就是**重新执行一遍所有代码**。这里就会伴随着许多变量的**删除、重新声明、运行......**有的时候会造成不必要的计算。试想一下，如果这个组件的结构是这样的
```

```typescript
const RootComponent() {
    useEffect(()=>{
        setSmallComponentRender(true)
        }, [])
    
    return (
        <VeryHeavyComponent />  // 不仅占用了页面几乎的所用空间，渲染一次至少还需要10s
        {smallComponentRender && <SmallComponent />}  // 状态改变还仅仅需要添加这样一个小东西
    )
}
```

如果真的重新执行了所有代码，也就意味着那个 `<VeryHeavyComponent  ``/``>` 也要重新渲染，不仅会造成卡顿，页面上的布局也会闪烁，这肯定不是我们想看到的。

React 对于这种非必要计算的省略方式就是 Hooks，例如 useMemo、useState 等。这些 Hooks 的简化版工作原理是这样的。

1. **Hook 链表**：每当你在组件中使用 hooks 时，React 在内部为当前组件实例维护一个 Hook 链表。每个 Hook 占据数组中的一个位置，按照它们出现的顺序。
2. **跨渲染保持状态**：在组件的重渲染过程中，React 通过这个数组来保持 hooks 的状态。例如，对于 `useState`，React 保持了 state 的当前值；对于 `useMemo`，React 保持了上一次计算的值和依赖数组。
3. **条件判断**：对于 `useMemo`，在组件的每次重渲染中，React 会比较依赖项数组中的值是否发生变化。只有当依赖项发生变化时，传给 `useMemo` 的函数才会重新执行。如果依赖项没有变化，`useMemo` 会返回上一次计算的值，避免了不必要的重计算。

#### 卸载时：

1. 调用清理函数：如果使用了 `useEffect` 或 `useLayoutEffect` hook，并且提供了清理函数（cleanup function），React 会在组件卸载前调用这些清理函数。这用于取消订阅事件、停止定时器、取消网络请求等。

> 为什么需要清理函数：
>
> - 节省浏览器的内存开销
> - 防止不必要的变量污染
> - 终止即将停止的全局事件
>   有些时候我们会看见这样一条错误警告
>   {% asset_img "TaCWbcFgtop7rkxXAS8cvv76nYb.png" "" %}
>   这一般都是代表你已经卸载的组件中有些全局操作或者定时器等，例如下面这些
>
> ```typescript
> ```

setInterval()
document.createElement()
element.addEventListener()
axios.get(...)

```
> 当然也不是所有绑定的事件在组件卸载时都需要一个个手动解除绑定。React会自动进行一些处理，例如
> ```typescript
useState(null)
useRef(null)
<Component onClick={()=>handleClick()} /> // 等等在组件中直接绑定的事件
```

1. 卸载 DOM 元素：React 会递归地卸载组件树中所有的 DOM 节点，从而解除对 DOM 的引用，有助于浏览器的垃圾回收机制回收这部分内存。
2. 移除 ref 引用：如果组件或其子组件使用了 `ref` 来引用 DOM 元素或其他组件实例，React 会将这些 `ref` 的当前值设置为 `null`，解除引用。
3. 卸载子组件：如果使用了 `useEffect` 等 hook，相关的清理函数会被执行。
4. 取消未处理的状态更新和副作用：如果组件在卸载时还有未处理的状态更新或副作用（如延迟执行的 `setState`），React 会取消这些更新和副作用的执行，以防止在组件已经不存在的情况下执行它们。
5. 移除事件监听器：通过 React 直接或间接（如通过 `useEffect`）添加的事件监听器，会在组件卸载时被移除。
6. 清理 Fiber 节点：React 内部使用 Fiber 架构来表示组件树。在组件卸载时，React 会清理与该组件相关的 Fiber 节点，释放相关资源。

## 4、渲染的优化

现在搞清楚了 React 中每个组件的生命周期，现在让我们开始从三角度对组件进行优化。

### 资源请求的优化（优化白屏时间）：

在 web 首次渲染页面的时候，如果没有 cache，就会向服务器请求各种文件，包括但不限于 JS、HTML、CSS 文件。这些文件都是代码，实际上占用和花费的时间不会很长。但是在遇到图片、字体文件的时候，因为文件本身的特性常常会花费很长时间。

{% asset_img "Nxerb42FYo8VPyx9bhjci4VKnGb.png" "" %}

这些文件在大小上面已经没有什么优化空间了，只能在请求时机上面优化。但是因为 HTTP1.1 的特性，浏览器对于每一个域名最多只会维护六条请求，同一时间剩下的请求即使创建了，也需要塞到后面执行。

对于字体文件，请求的时机就很重要了。如果早了，阻塞请求通道，会让白屏时间加长。如果晚了，页面都渲染出来了，但是里面有的地方有文字，有的地方没有。

> 关于字体文件请求的优化，可以去看 [web.dev](https://web.dev/articles/optimize-webfont-loading?hl=zh-cn#the-font-loading-api)

对于图片文件，可以使用 Web Api 中的 **IntersectionObserver** 只请求当前页面中需要的图片，对于其他的可以通过懒加载延后请求。

### 组件内的优化（优化响应效果）：

因为组件的重新渲染会造成整个组件的代码重新运行，但是 Hooks 却不会，所以我们要对组件中的变量进行持久化处理，让他们尽量少的占用浏览器资源。

> 💡 **重要**
> 虽然 Hooks 的使用能够让浏览器省去许多没有必要的变量重建，但是同样在创建 Hook 的时候也会伴随许多控制这个 Hook 的变量，回调等等被创建。如果非必要，一些简单的属性最好不使用 Hooks 进行管理。
> 如果不清楚添加了这个 Hook 会不会造成 `负优化`，可以活用 `DevTools` 中的 `Performance` 选项卡进行调试

#### useState：

通过上面的分析，我们知道 state 的改变是造成组件重新渲染的重大原因之一，所以我们要弄清楚什么时候需要将这个变量设置成 state

> 这里引用 React 哲学中关于 state 的定义，所有的 Hook 使用基本都遵循这些原则

#### useMemo、useCallBack：

通过这两个 Hook，能够做到在整个组件的生命周期中 `memory` 一些变量，并且只在他的依赖项改变时重新运行，就像 `useEffect` 那样

{% asset_img "X0CmbxcmaovbLNxVV6McHDGvnwg.png" "" %}

> React 中还有个内置高阶组件 React.memo，这个组件会将包裹的组件同样 `memory` 住，但是这个 memory 却不能传递依赖参数，每一次父组件的重新渲染都会让他进行一次浅比较，只会对比 props 是否改变，如果改变，就重新渲染
> 但是当这个组件里面包含了 `useContext` 的时候，无论是否被 memo 包裹，在 context 的 value 变化的时候，都会进行重新渲染

### 父组件级的优化（优化响应效果）：

#### useState：

再父组件中因为每一次状态改变都会让整个父组件重新渲染，所以可以将这些 state 经过评估后有选择的下放， 让他们影响到的子组件自行渲染。

{% asset_img "S1mObOJoKoRNXjx54Zcce13pnhe.png" "" %}

#### React.Memo：

`React.memo` 是一个高阶组件。它对传入的组件进行浅比较，以确定是否需要进行重新渲染。如果组件的 props 没有发生变化，那么 React 会跳过渲染这个组件及其子组件，这样可以提高性能。

{% asset_img "UAhKbOz5boEIBexqEvgc12dOnEg.png" "" %}

#### useContext：

当我们操作全局的 `Context` 的时候，例如用户信息或者主题颜色等，常常会将 `Provider` 包裹在组件树偏上的地方，甚至直接包裹一整个 `<App ``/>`。一旦有什么时候改变了 `Context` 的 value，这也被视为一种状态改变，React 会将这个包含 `Provider` 的组件完全重新渲染，同时子组件也会重新渲染。这通常会在前端界面中给用户的操作造成很难受的感觉。

有的时候可以将这个组件下的所有组件都用 `React.memo` 包裹起来，这样在遇见最上层组件的 context 更新导致的重新渲染时，就可以只让使用了 `Context` 的组件重新渲染。

```typescript
const _MainComponent _= React._memo_(
    function _MainComponent_() {
        console.log("MainComponent render")
        return (
            <>
                <ChildComponent/> // 组件的函数体中写了console.log("ChildComponent render")
                <ContextChildComponent /> // 组件的函数体中写了console.log("ContextChildComponent render")
            </>
        )
})

function _App_() {
    console.log("App render")
    const [contextValue, setContextValue] = _useState_({value: 1})

    _useEffect_(() => {
        setContextValue({value: 2})
    }, []);

    return (
    <div className="App">
        <Context.Provider value={contextValue}>
            <MainComponent />
        </Context.Provider>
    </div>
    );
}
```

这样在 `Context` 更新的时候可以看见除了 `App` 重新渲染了之外，只有使用了 `Context` 的 `ContextChildComponent` 重新渲染了。如果 ChildComponent 是一个非常大的列表，每次重新渲染都需要数十秒，这样就都能够节省下来。

{% asset_img "GuKKbhioVo4sDuxDOE7caKATn5d.png" "" %}

# 三、总结

虽然我在上述说了各种对于渲染优化的办法，但是并不推荐从项目立项之初就开始想着这个算法怎么实现，这个组件怎么优化之类的问题，因为

## **“过早优化是万恶之源”**

> 这句话是 Tony Hoare 提出的

{% asset_img "MU9yb9WzIoRWJexEZQkcUJS8nod.png" "" %}

有些时候，现在的**浏览器优化程度（V8 确实已经封顶了）**和**用户的硬件设备**有些时候已经**过度饱和**。几乎不用做出特定优化，除非是那种特别的大型项目，比如飞书和 QQ。确实需要一定程度上的优化，就放在当初，还在用老 qq 的时候那个新的频道板块都卡成什么样子了。当然也不排除本来当时 electron 之类的 web 框架不成熟和

## **“史山代码”**

随着计算机系统性能从 MHz，数百 MHz 到 GHz 的增加，计算机软件的性能已经不是最重要的问题（落后于其他问题）。今天，有些软件工程师将这个格言扩展到**“你永远不应该优化你的代码！”**，他们发现，有时候代码怎么写似乎问题都不大。

然而，在许多现代应用程序中发现的臃肿和反应迟钝的问题（点名批评 QQ），迫使软件工程师重新考虑如何将 Hoare 的话应用于他们的项目。

查尔斯库克的一篇简短的文章，其中一部分我在下面转载，描述了在 Hoare 的陈述中的问题：

> _我一直认为这句话经常导致__软件设计__师犯严重错误，因为它已经被应用到了不同的问题领域。这句话的完整版是“We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil.”_

我同意这一点。在性能瓶颈明显之前，通常不值得花费大量时间对代码进行细枝末节的优化。但是，在设计软件时，应该从一开始就考虑性能问题。一个好的软件开发人员会自动做到这一点，他们大概知道性能问题会在哪里出现。没有经验的开发人员不会关注这个点，错误地认为在后期进行一些微调可以解决任何性能问题。

Hoare 和 Knuth 真正说的是，软件工程师在担心**微观优化**（比如一个特定语句消耗多少 CPU 周期）之前，应该先担心其他问题（比如**好的架构设计**和这些**架构的良好实现**）。

## 叠甲

优化这种东西本来就是一种态度和热爱，就像算法一样，一次又一次追求更高效的算法，看着运行时间逐渐缩短。不仅能为开源社区做出巨大贡献，就算是自己看着也会赏心悦目。

逐渐追求更加优雅高效的实现方式，逐渐更加接近原生开发出来的应用效率，都是自己的追求。

所有事情都是存在即合理，只要保证自己的开发习惯始终如一，不要看了别的大佬口中的 **codestyle** 就强迫自己立马改变思考方式，无脑追随、毕竟你的 **codestyle** 也是 style（独有特色）的。

如果真的让**曾经的热爱变成一生的煎熬**，也确实不过可悲。
