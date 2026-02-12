---
title: JavaScript 的代码执行过程
abbrlink: 31ccda14
---


> 本篇文章侧重点在于对 JavaScript **在浏览器**中的代码执行过程抽象模型解释。只包括 ECMA 规范中的第八章 [Executable Code and Execution Contexts](https://262.ecma-international.org/6.0/#sec-executable-code-and-execution-contexts) 部分。
> 本篇文章中出现的 ECMA 规范均从 [2015 年的 ES6](https://262.ecma-international.org/6.0/#sec-lexical-environments) 中截取

# **Executable Code and Execution Contexts 是什么**

在 ECMAScript 规范中，**Executable Code and Execution Contexts** 部分处于非常关键的地位，描述了 JavaScript 代码的执行模型，解释了不同类型的代码如何被解释和执行，以及如何管理变量、作用域链和 `this` 绑定。

> 关于在我们主动非 class 内部使用 this 的情况非常少见。所以后面会很少提及关于 this 如何确定的问题，只会在执行上下文处提一嘴他是如何查找的。

## **解释内容**

- **可执行代码（Executable Code）**：描述了脚本代码、函数代码和模块代码的不同类型。
- **执行上下文（Execution Contexts）**：介绍了每个代码片段执行时所需要的上下文，包括函数、全局、模块等上下文类型，以及每种上下文所包含的组成部分，如词法环境、变量环境、`this` 绑定等。

## **解决的问题**

- **作用域管理**：定义了如何通过词法环境和变量环境来管理不同作用域中的标识符绑定。
- **控制流管理**：确保函数调用、块级作用域和全局执行有正确的上下文管理顺序，支持递归调用、闭包等特性。
- **内存管理**：通过执行上下文和词法环境的管理，明确了变量的可见性和生命周期。

# JavaScript 的代码执行模型都包含了哪些东西

> 这部分只是作为一个抽象的梳理，里面涉及到的所有东西会在下面作出详细解释

{% asset_img "QGf0bFJ6ioCkzzxGdP8cZds8n1e.png" "" %}

- **任务队列**：是一个**独立的队列**，有自己的管理系统。在 JavaScript 中有许多异步操作或者延迟执行，这些操作就会统一放到**任务队列**里面进行管理。然后在恰当的时候放入**执行上下文栈。**
- **执行上下文栈**：是另一个**独立的栈结构**。是一个用于存储所有当前代码正在执行或等待执行的**执行上下文**的栈结构，采用**先进后出**（FILO）的方式。

  - **执行上下文**：是 JavaScript 中执行代码时的环境，每个执行上下文包含了代码执行所需的所有信息，包括变量、作用域链、`this` 绑定等。
- **词法环境**：是另一个**独立的数据结构**。是一种抽象机制，用于管理变量和函数的声明。

  - **环境记录**：用于存储标识符的绑定，例如变量、函数、参数等。
  - **外部环境引用**：用于形成**作用域链**，确保变量可以逐级向上查找。

# 执行上下文栈（ Execution Context Stack ）

EMCA 官方规范里面并没有对于执行上下文栈有很明确的定义，只是在执行上下文中提到了有一个栈结构来保存并管理执行上下文而已

> An _execution context_ is a specification device that is used to track the runtime evaluation of code by an ECMAScript implementation. At any point in time, there is at most one execution context that is actually executing code. This is known as the _running_ execution context. A stack is used to track execution contexts. The running execution context is always the top element of this stack. A new execution context is created whenever control is transferred from the executable code associated with the currently running execution context to executable code that is not associated with that execution context. The newly created execution context is pushed onto the stack and becomes the running execution context.

需要明确的是：**执行上下文栈是一定会涉及到里面内容的新增和销毁的，所以他并不会保存任何数据，而主要是管理代码的执行顺序**

由上述官方文档我们可以了解到，这个栈结构采用的是**后进先出（LIFO）**的结构管理这个栈中的每一个执行上下文。而且同一时间**只能有一个**执行上下文正在执行。那么

## 执行上下文栈结构解决了什么问题

1. **保持函数调用的顺序一致**：当一个函数被调用时，它的执行上下文会被压入栈中；当这个函数执行完毕时，它的执行上下文会从栈中弹出。这确保了函数在结束后能够回到它的调用点，继续执行剩余的代码。
2. **支持嵌套调用**：函数内部可以调用其他函数，形成嵌套调用。栈结构确保最后调用的函数在执行完毕后，能够返回到前一个函数的上下文，保持执行的正确顺序。
3. **简化递归调用管理**：对于递归函数，栈结构允许函数的多次调用上下文依次被压入栈中，确保递归结束时能够按照正确的顺序逐层返回。

## 执行上下文栈在浏览器前端里面是否有实例化的实现

答案是**肯定**的，就在 浏览器开发者控制台 -> 源代码/来源 -> 调用堆栈

{% asset_img "Zg60bYKVioLtiDxE4zRcXLEdnOe.png" "" %}

## 执行上下文（ Execution Context ）

先来看看 EMCA 官方规范里面关于执行上下文的定义

> An execution context is a specification device that is used to track the runtime evaluation of code by an ECMAScript implementation. At any point in time, there is at most one execution context that is actually executing code. This is known as the running execution context.A stack is used to track execution contexts. The running execution context is always the top element of this stack. A new execution context is created whenever control is transferred from the executable code associated with the currently running execution context to executable code that is not associated with that execution context. The newly created execution context is pushed onto the stack and becomes the running execution context.
> 执行上下文是一种规范类型，用于跟踪 ECMAScript 实现（也就是 JavaScript 语言）代码的执行状态。在任意（代码执行）的时间点中，最多有一个执行上下文在实际执行代码。这称为运行执行上下文。堆栈用于跟踪执行上下文。正在运行的执行上下文始终是该堆栈的顶部元素。每当控制从与当前运行的执行上下文关联的可执行代码转移到不与该执行上下文关联的可执行代码时，就会创建新的执行上下文。新创建的执行上下文被压入堆栈并成为正在运行的执行上下文。

### 执行上下文解决了什么问题

执行上下文（Execution Context）的存在解决了 JavaScript 在代码执行过程中**管理**作用域、变量、函数调用和 `this` 绑定的问题。它提供了一种结构化的方式来组织和管理不同代码段（如全局代码、函数、eval）的执行，确保在不同执行阶段正确地创建和销毁变量与引用，维护代码执行的正确性和内存的有效利用。

> 💡 **重要**
> 执行上下文只是 **管理**里面的作用域、变量、函数调用和 `this` 绑定等等问题。而这些结构并不会放在执行上下文中进行保存，也就是说在执行上下文被从执行上下文栈中移除的时候并不会带着这些结构一起被删除，而是会由 GC（Garbage Collection）进行统一的管理

### 执行上下文的类别

首先，V8 环境中的上下文分如下这几个类别

```cpp
// V8 引擎源码截取自 src/objects/contexts.h

class Context : public TorqueGeneratedContext<Context, HeapObject> {
    // 省略无关代码
    
    inline Tagged<NativeContext> native_context() const;  // **全局执行上下文**:
    inline bool IsDetached() const;
    
    // Predicates for context types.  IsNativeContext is already defined on
    // Object.
    inline bool IsFunctionContext() const;  // **函数执行上下文**
    inline bool IsCatchContext() const;  // **try ... catch ... 执行上下文**
    inline bool IsWithContext() const;  // **with {} 执行上下文**
    inline bool IsDebugEvaluateContext() const;  // **调试执行上下文**
    inline bool IsAwaitContext() const;  // **await 执行上下文**
    inline bool IsBlockContext() const;  // **块级执行上下文**
    inline bool IsModuleContext() const;  // **模块执行上下文**
    inline bool IsEvalContext() const;  // **eval 执行上下文**
    
    // 省略无关代码

}
```

- **全局执行上下文**：当 JavaScript 脚本**开始执行时**就会创建全局执行上下文。他会一直在整个页面生命周期内存在。
- **其他的各种类别上下文均在执行相应代码的时候才会创建和执行**

> eg：在 JS 代码执行到函数相关的时候就会创建一个函数执行上下文

### 执行上下文的内容

先来看一下 ECMA 官方规范里面的定义

> An execution context contains whatever implementation specific state is necessary to track the execution progress of its associated code. Each execution context has at least the state components listed in [Table 22](https://262.ecma-international.org/6.0/#table-22).
> 执行上下文包含跟踪与其相关代码执行进度所需的所有实现特定状态。每个执行上下文至少包含表 22 中列出的状态组件。
> {% asset_img "MOKgbNJosoSvc2x2JvHcuUZUn8f.png" "" %}
> Execution contexts for ECMAScript code have the additional state components listed in [Table 23](https://262.ecma-international.org/6.0/#table-23).
> ECMAScript 代码的执行上下文还包含表 23 中列出的其他状态组件
> {% asset_img "QMOUb395hoN0kCxfurQcAtiZn8d.png" "" %}
> Execution contexts representing the evaluation of generator objects have the additional state components listed in [Table 24](https://262.ecma-international.org/6.0/#table-24).
> 表示生成器对象评估的执行上下文具有表 24 中列出的附加状态组件。
> {% asset_img "Us44bD5LUo2TgtxwdpzcvVSYnUd.png" "" %}

总结一下

<table>
<tr>
<td>组件<br/></td><td>注释<br/></td></tr>
<tr>
<td>code evaluation state<br/></td><td>记录执行上下文代码执行、挂起和恢复等状态<br/></td></tr>
<tr>
<td>Function<br/></td><td>如果当前执行上下文正在执行的是函数对象的代码，Function 值指向正在执行的函数对象，如果是执行的是脚本和模块，该值为 null。正在运行的执行上下文的 Function 值也称为活动函数对象<br/></td></tr>
<tr>
<td>Realm<br/></td><td>关联代码访问ECMAScript资源，指代当前上下文所属领域的资源，包括全局对象、与此领域相关的代码使用的内在值等等，用于隔离其他领域<br/></td></tr>
<tr>
<td>LexicalEnvironment<br/></td><td>Identifies（辨认，识别，认出，鉴定，确认，验明）一个词法环境，`let`和`const`声明的变量会挂载到该标识符引用的词法环境中<br/></td></tr>
<tr>
<td>VariableEnvironment<br/></td><td>Identifies 一个变量环境，也就是var声明的变量会存储在此环境中<br/></td></tr>
<tr>
<td>Generator<br/></td><td>记录当前正在解析的执行器对象<br/></td></tr>
</table>

#### code evaluation state

主要用于记录当前执行上下文的执行状态，有下面这几种状态

- perform（执行）
- suspend（挂起）
- resume（恢复）

因为执行上下文栈只能允许最顶层的一个执行上下文运行。所以当执行上下文栈中创建了新的执行上下文，且这个执行上下文被推到了栈顶，需要开始执行的时候。原来的执行上下文的状态就需要变为 suspend，新增的执行上下文状态变为 perform，等待这个执行上下文工作完毕的时候，原来的执行上下文状态切换为 resume。如果有多层嵌套的话同理

#### Function

在函数执行上下文中，Function 部分指向的是函数本身。可以让 JavaScript 引擎识别并管理当前正在执行的函数

管理函数执行状态：

- 当函数进行递归调用时，多个相同的函数执行上下文会被创建。
- Function 部分使引擎能够区分不同层次的递归调用，每个调用都有自己的函数对象引用。
- Function 部分帮助保存对函数对象的引用，使得闭包可以正确访问其词法作用域中的变量。

`arguments` 对象的创建：

- Function 部分提供了对函数参数的元信息，便于构建 `arguments` 对象。
- 这包括参数的数量、默认值等。

`this` 绑定的确定：

- 在非箭头函数中，`this` 的值取决于函数的调用方式。
- Function 部分有助于引擎在函数执行时正确确定 `this` 的指向。

异常处理和栈追踪：

- Function 部分使得在抛出异常时，可以提供准确的调用栈信息。
- 有助于调试和错误定位。

#### Realm

这是一个比较大的概念，先来看看 ECMA 规范是如何定义的

> Before it is evaluated, all ECMAScript code must be associated with a _Realm_. Conceptually, a realm consists of a set of intrinsic objects, an ECMAScript global environment, all of the ECMAScript code that is loaded within the scope of that global environment, and other associated state and resources.
> A Realm is specified as a Record with the fields specified in [Table 21](https://262.ecma-international.org/6.0/#table-21):
> {% asset_img "JchKbuHzgoO8CLxj99IcqUe6nsd.png" "" %}

总结一下，一个 Realm 由这些部分组成

<table>
<tr>
<td>字段名<br/></td><td>值<br/></td><td>意义<br/></td></tr>
<tr>
<td>`[[intrinsics]]`<br/></td><td>Objects<br/></td><td>当前Realm中的内部固有对象，比如`Object`，`Function`,`Boolean`等<br/></td></tr>
<tr>
<td>`[[globalThis]]`<br/></td><td>Object<br/></td><td>当前Realm中的全局对象<br/></td></tr>
<tr>
<td>`[[globalEnv]]`<br/></td><td>Lexical Environment<br/></td><td>当前Realm中的词法环境<br/></td></tr>
<tr>
<td>`[[templateMap]]`<br/></td><td>A List of Record {[[strings]]: List, [[array]]: Object}<br/></td><td>当前Realm中的模版（比如字符串模版）的存储信息，比如JavaScript具体实现中，是用来存储模板字符串（template string）的缓存。下次再找模版会优先从此处查询<br/></td></tr>
</table>

它关联代码访问的所有 **ECMAScript 资源**，包括全局对象、内在对象（如内置类 `Object`、`Array`）、标准库函数（如 `Math`）等，但是并不包含除了全局上下文带来的作用域以外的其他作用域。

> 可能这个概念听起来和 Lexical Environment 有点像，但是实际上 Realm 解决的是不同执行环境之间的隔离问题，包括全局对象和标准库等资源的隔离。而 Lexical Environment 解决的是执行代码时的作用域和标识符查找问题，它用于在函数调用、块级作用域中管理局部变量的可见性

实际上在浏览器环境中，`window` 是就是一个 `Realm`, node 中的 global 也是一个 `Realm`，对比我们平常熟知的作用域概念，Realm 更符合 JS 代码实际执行中需要的“执行环境”。

#### LexicalEnvironment

注意，这里面的 LexicalEnvironment 并不是一个 Lexical Environment（词法环境） 实例，而是**类似于**从外部 Lexical Environment（词法环境） 的一个引用而已。所以在当前执行上下文从执行上下文栈弹出并销毁的时候，对应的真实词法环境并不会立马销毁。

具体 Lexical Environment 是什么在下面有解释

#### VariableEnvironment

同理如上

#### Generator

只有当函数是一个生成器函数的时候，即用 [function*](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) 关键字定义的函数，这个字段才有用。保存了当前生成器函数的执行状态等

在 **执行上下文的类别** 模块中声明出来的每一种情况都会创建自己类型的词法环境

### 执行上下文中关于 this 的方法

> <u>8.3.2</u>GetThisEnvironment ( )
> The abstract operation GetThisEnvironment finds the [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) that currently supplies the binding of the keyword **this**. GetThisEnvironment performs the following steps:
>
> 1. Let _lex_ be [the running execution context](https://262.ecma-international.org/6.0/#sec-execution-contexts)’s [LexicalEnvironment](https://262.ecma-international.org/6.0/#sec-execution-contexts).
> 2. Repeat
>    1. Let _envRec_ be _lex_’s [EnvironmentRecord](https://262.ecma-international.org/6.0/#sec-lexical-environments).
>    2. Let _exists_ be _envRec_.HasThisBinding().
>    3. If _exists_ is **true**, return _envRec_.
>    4. Let _outer_ be the value of _lex’s_ [outer environment reference](https://262.ecma-international.org/6.0/#sec-lexical-environments).
>    5. Let _lex_ be _outer_.
>    NOTEThe loop in step 2 will always terminate because the list of environments always ends with [the global environment](https://262.ecma-international.org/6.0/#sec-global-environment-records) which has a **this** binding.
>    [8.3.3](https://262.ecma-international.org/6.0/#sec-resolvethisbinding)ResolveThisBinding ( )
>    The abstract operation ResolveThisBinding determines the binding of the keyword **this** using the [LexicalEnvironment](https://262.ecma-international.org/6.0/#sec-execution-contexts) of [the running execution context](https://262.ecma-international.org/6.0/#sec-execution-contexts). ResolveThisBinding performs the following steps:
> 3. Let _envRec_ be [GetThisEnvironment](https://262.ecma-international.org/6.0/#sec-getthisenvironment)( ).
> 4. Return _envRec_.GetThisBinding().

总结一下就是

`GetThisEnvironment` 的目的是查找提供 `this` 绑定的环境记录。它通过遍历当前执行上下文的词法环境（`LexicalEnvironment`）链，直到找到有 `this` 绑定的环境记录。具体步骤如下：

1. 从当前的执行上下文的词法环境开始。
2. 对当前环境记录调用 `HasThisBinding()` 检查它是否包含 `this` 绑定。
3. 如果找到了 `this` 绑定，就返回该环境记录。
4. 如果当前环境没有 `this` 绑定，则继续查找外部环境，直到找到最外层的全局环境。

这意味着 `this` 的绑定依赖于查找过程，逐层检查从最内层作用域到外层作用域的环境记录，直到找到包含 `this` 绑定的那一层。

### ❗️ 关于 eval 的陷阱

#### 非严格模式下灵活的 eval

如果不使用 `"use strict"` 模式，在 eval 中创建的执行上下文中会直接复用全局执行上下文。并且所有对于全局环境下的影响也会直接影响到外部的全局执行上下文

```javascript
function a() {
  const value = "a"
  console.log(value)
}

eval("function func() {
    console.log('eval')
}
   function evala() {
       console.log('eval a')
}
   func()
   a()
   evala()")
evala()
```

{% asset_img "UepabRZOGo4iNtxkmR7cQ4yGn5r.png" "" %}
Eval 中的“独立”上下文
{% asset_img "TTJ6bLgRQoVdc3x71Cyc0jodnTd.png" "" %}
全局上下文

{% asset_img "CxxRbuWPAoYpD8xxNFTccNjrnsD.png" "" %}

这个时候会发现就算在外部的全局上下文中依然能够查找到 evala 函数并且返回了正确的函数体和执行结果。

因为在**非严格模式**下，`eval()` 被设计为能够访问和修改其调用上下文的变量和函数。这意味着 `eval()` 执行时与其调用上下文共享了**作用域链**，而且在 `eval()` 中定义的变量和函数会被提升到外部的**环境记录**中，使它们可以在全局或调用函数中访问

#### 严格模式下安全的 eval

在使用了 `"use strict"` 模式后，在 eval 的环境中会有独立的一个字段用来保存 eval 中对于全局上下文的影响

{% asset_img "XN2TbSCYbogLZwxzhmwcvGsSn54.png" "" %}
Eval 中的“真”独立上下文
{% asset_img "ZIvRb2EPXojqMuxEhFDcUpTzngm.png" "" %}
全局上下文

{% asset_img "El4DbMfFcofmG3xOT6ccZEAtnuh.png" "" %}

这个时候会发现在外部全局上下文中查找不到 evala 函数了，实现了常规意义下的“独立”。而且这样就会更加安全，防止因为 `eval()` 中传参的不确定性修改外部作用域中的变量和函数，也减少了全局污染。

实际上上面 `Eval 中的“真”独立上下文` 那个图片中右边作用域里面的 `Eval` 字段是因为创建了另一个**词法环境**，实现了类似**块级作用域**一样的效果：在 eval 中维护的环境结束的时候自动清理里面的变量和函数等。

> 💡 **重要**
> 
> ### **JavaScript 的设计考虑**
> 
> - JavaScript 的设计目标之一是提供一种高度动态和灵活的语言特性，`eval()` 就是这种特性的代表。在非严格模式下，`eval()` 被视为“代码内联执行”，其作用类似于代码直接写在调用的地方。因此，它的变量和函数会被提升到调用环境，就像这些代码本身原来就在调用环境中一样。
> - 这也是为什么在非严格模式下，`eval()` 会有更大的灵活性，但也带来了安全和性能上的问题。因为它能够直接修改当前环境，导致全局污染，容易引发难以调试的错误和潜在的安全漏洞。

# 任务队列（ Job Queue / Microtask Queue）

> 💡 **重要**
> 明确一个事情：JavaScript 中的任务队列**仅仅保存**异步任务中的微任务（Promise 等）。宏任务（setTimeout，**网络请求** 等）由**宿主环境管理**，也就是浏览器或者 NodeJS。所以事件循环相关内容在这并不作为讨论，想要了解相关内容欢迎移步另一篇文章 [《浏览器的事件循环》](https://ncuhomer.feishu.cn/wiki/Wd7lw7oLRiUk6dk9huNcNP7Bnqc)（还没写完呢）
> 这里主要讨论引擎是如何处理同步代码以及其带来的微任务副作用

先来看看 EMCA 规范中对于任务队列的定义（Job Queue）

> A Job is an abstract operation that initiates an ECMAScript computation when no other ECMAScript computation is currently in progress. A Job abstract operation may be defined to accept an arbitrary set of job parameters.
> Execution of a Job can be initiated only when there is no running [execution context](https://262.ecma-international.org/6.0/#sec-execution-contexts) and [the execution context stack](https://262.ecma-international.org/6.0/#sec-execution-contexts) is empty. A PendingJob is a request for the future execution of a Job. A PendingJob is an internal Record whose fields are specified in [Table 25](https://262.ecma-international.org/6.0/#table-25). Once execution of a Job is initiated, the Job always executes to completion. No other Job may be initiated until the currently running Job completes. However, the currently running Job or external events may cause the enqueuing of additional PendingJobs that may be initiated sometime after completion of the currently running Job.
> 工作是一个抽象操作，当没有其他 ECMAScript 计算正在进行时，它将启动 ECMAScript 的计算。工作抽象操作可以定义为接受任意一组工作参数。
> 作业的执行只能在没有任何正在运行的执行上下文且执行上下文栈为空时启动。待执行作业（PendingJob）是请求未来执行作业的请求。待执行作业是一个内部记录，其字段在表 25 中指定。一旦启动作业的执行，作业将始终执行到完成。在当前运行的作业完成之前，不得启动其他作业。然而，当前运行的作业或外部事件可能导致在当前运行的作业完成后，将额外的待执行作业（PendingJobs）入队，这些作业可能在当前运行的作业完成后被启动。

**总结**：任务队列存放了当前执行中的所有异步任务（Promise、async await 等）。并且在执行上下文栈为空（所有同步代码执行完成）的时候开始启动任务执行

## 在 V8 环境中任务队列解决了什么问题

因为 JavaScript 是单线程语言，一旦涉及到代码的延迟执行或者某些异步操作。任务队列允许 V8 在处理同步任务后处理异步任务，以避免阻塞程序执行。

任务队列提供了一个有序机制来**管理执行异步代码**，确保所有同步代码在进入异步任务队列前执行完毕，这解决了 JavaScript 中异步代码的调度和执行顺序问题，使其行为更可预测并有助于提升代码的非阻塞特性和响应能力。

## 任务队列是如何工作的

### 都有哪些情况会创建任务（微任务）

#### Promise 回调

当 `Promise` 的状态变为 `fulfilled` 或 `rejected` 时，`.then()`、`.catch()`、`.finally()` 中需要被执行的回调会被**依次**加入微任务队列

```javascript
const promise = new Promise((resovle) => {
    resovle("promise")  // 当代码执行到这里的时候就已经在微任务队列中添加了对应回调函数
})

promise.then((res)=>{
    console.log(res)
})
```

#### queueMicrotask() 回调

`queueMicrotask()` 可以显式向微任务队列添加任务。

这个任务不会被提前或者延后，就是像正常的微任务一样被添加到上一个任务的后面。

{% asset_img "JAc1b7vzYoxgjox2F90c8YD7nnc.png" "" %}

#### async / await 系代码

在 async 定义的函数中每一个 await 关键字后面的代码会被包装为 promise 中的回调执行，而不是将整个 async 定义的函数在调用的时候整个添加进入微任务队列。

当一个 `async` 函数被调用时，它会立即执行函数体中**第一个 ****await**** 之前**的所有代码。这个部分是作为**同步代码**来处理的。直到遇到第一个 `await` 关键字，JavaScript 才会暂停该 `async` 函数的执行，并将其后续代码交由一个**微任务**来执行。

{% asset_img "Z38ebFkJoo9bnkx4C7RcNbObnPd.png" "" %}

#### 其他微任务同理，都会按顺序添加

### 什么时候会开始执行微任务

在当前执行上下文栈为空，即所有同步代码执行完毕后。开始从微任务队列中**从后向前**取出任务依次执行。

## ❗️ 关于网络请求和 Promise 的结合：

我们都知道网络请求是宏任务、但是 Promise 系涉及到的却是微任务。但是现代的原生方法和第三方库却都能将他们封装为 Promise 链类的方法进行调用。但是在背后他们到底是如何执行的呢？

### 一个关于 Promise 对象**可能是误区**的地方：

对于 `Promise` 对象来说，只有在调用 `resolve()` 或 `reject()` 时，才会将他的状态改变，然后将 `Promise` 的 `.then()` 或 `.catch()` 回调添加到**微任务队列**中，而不是在调用 `.then()` 的位置立即添加到微任务队列中。换句话说，`.then()` 方法本身只是注册了一个回调函数，这个回调函数在 `Promise` 的状态变为已解决（fulfilled）或者已拒绝（rejected）后，这个回调函数中涉及到的内容才会被加入到微任务队列中。

### 关于网络请求

所以在我们使用 axios 或者 fetch 等被封装为 promise 链式调用的网络请求的方式的时候，其实我们是从始至终没有明文也没有机会调用过他的 `resovle()` 或者 `reject()` 方法的。如果我们手动在浏览器的控制台里面尝试查看 `new XMLHttpRequest().send` 或者 `fetch` 的源代码，会发现返回的是 `{ [native code] }` 这样的字段。表明这些方法是浏览器提供的原生方法，由浏览器的底层实现。它们的执行涉及浏览器与系统的交互，并不完全由 JavaScript 引擎控制，而是在浏览器中由其他线程或模块进行处理。

{% asset_img "C26BbjNWToYHLzxUkPVcRgNmntf.png" "" %}

所以他们何时改变状态，也不是我们的 JavaScript 代码可以控制的。而是浏览器进行全权控制，所以他们就会被提升为宏任务。浏览器和系统硬件交互，知道了这个请求最终什么时候被返回，才会手动切换他们的状态，然后将他们涉及到的回调函数注册进 JavaScript 引擎的微任务队列中，在下一次事件循环的时候去处理。

### 关于网络请求和 Promise 结合的时候到底是怎样的执行顺序

1. 涉及到网络请求这样的 JavaScript 代码会在执行到这里的时候被挂起，也就是暂停执行。同时他们的执行上下文和词法环境等也会被保存。
2. JavaScript 引擎将这个网络请求暴露到浏览器中，让浏览器负责和系统硬件交互的进程去处理这个请求。然后 JavaScript 引擎继续执行剩余代码。
3. 当这个网络请求在浏览器中有了执行结果，请求成功会将对应 `resovle()` 的回调函数、反之会将对应的 `reject()` 回调添加到浏览器的**宏任务队列**。等待 JavaScript 引擎执行代码对其进行处理。

> ❗️ 重要：**一般情况下** Promise 对象对应的回调函数会添加到当前事件循环中的**微任务队列**。但是网络请求对应的回调会添加到**宏任务队列，**因为网络请求的 Promise 对应的状态并不由 JavaScript 引擎管理
> {% asset_img "I0wibTUdgoOOKfx4LNdciznqnLc.png" "" %}
> 这个时候在浏览器开发者控制台的网络部分已经可以看见发出了请求，也有了返回值，正在等待回调函数执行

4. 在浏览器从宏任务队列中应该取出这个回调函数并执行的时候，才会真正执行对应的回调函数

### 实例证明

我们有如下代码

```typescript
const asyncHttpRequest = new Promise((_resolve_, _reject_) => {
    console.log("asyncHttpRequest Promise 被创建了");

    fetch('https://jsonplaceholder.typicode.com/posts/1')
    .then(_response_ => {
        _return_ _response_.json();
    })
    .then(_data_ => {
        console.log("请求处理完成：", _data_);
    });

    const asyncPromise = new Promise((_resolve_, _reject_) => {
        console.log("asyncPromise 被创建了");
        resolve("我是 asyncPromise 的 resovle");
    });

    asyncPromise.then((_value_) => {
        const time = Date.now();
        console.log("在 asyncPromise 里面强制等待 5s");
        _while_ (Date.now() - time < 5000) {}
        console.log(_value_);
    });
    
    const time = Date.now();

    console.log("在 asyncHttpRequest 里面强制等待 5s");
    
    _while_ (Date.now() - time < 5000) {}
    resolve("asyncHttpRequest 被 fulfill 了");
    
    console.log("asyncHttpRequest 创建结束");
});

asyncHttpRequest
    .then((_value_) => {
        console.log("asyncHttpRequest then 了 value:", _value_);
    })

_// 在这里添加了两个宏任务，验证一下网络请求对应回调到底是微任务还是宏任务_
// 如果是当前事件循环中的微任务，会在 console.log('我是 setTimeout 对应的第一个宏任务带来的回调函数') 之前执行
// 如果是下一个事件循环中的微任务，会在 console.log('我是 setTimeout 对应的第二个宏任务带来的回调函数') 之前执行
// 如果是宏任务，会在 console.log('我是 setTimeout 对应的第二个宏任务带来的回调函数') 后面执行
setTimeout(()=>{
    console.log('我是 setTimeout 对应的第一个宏任务带来的回调函数')
}, 1000)
setTimeout(()=>{
    console.log('我是 setTimeout 对应的第二个宏任务带来的回调函数')
}, 2000)
```

实际上控制台里面的输出是这样的

> {% asset_img "QD3SbIGbLoNrhTxKsR5cFLH3nIc.png" "" %}

# 词法环境（ Lexical Environment  ）

这是另一个比较大的概念，先来看看 ECMA 规范中对于他的定义

> and functions based upon the lexical nesting structure of ECMAScript code. A Lexical Environment consists of an [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) and a possibly null reference to an _outer_ Lexical Environment. Usually a Lexical Environment is associated with some specific syntactic structure of ECMAScript code such as a _FunctionDeclaration_, a _BlockStatement_, or a _Catch_ clause of a _TryStatement_ and a new Lexical Environment is created each time such code is evaluated.
> 一个词法环境是一种用于定义标识符与特定变量和函数之间关联的规范类型，这种关联基于 ECMAScript 代码的词法嵌套结构。词法环境由一个环境记录和一个可能为 null 的外部词法环境引用组成。通常，词法环境与 ECMAScript 代码的某些特定语法结构相关联，例如函数声明、块语句或 try 语句的 catch 子句，每次评估此类代码时都会创建一个新的词法环境。
> An [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) records the identifier bindings that are created within the scope of its associated Lexical Environment. It is referred to as the Lexical Environment’s EnvironmentRecord
> 一个环境记录记录了在其关联的词法环境作用域内创建的标识符绑定。它被称为词法环境的 EnvironmentRecord。

总结，一个词法环境由以下部分组成

<table>
<tr>
<td>Environment Record<br/></td><td>一个环境记录记录了在其关联的词法环境作用域内创建的标识符绑定。相当于保存了当前词法环境中声明的各种内容<br/></td></tr>
<tr>
<td>_outer_ Lexical Environment<br/></td><td>上级词法环境的引用<br/></td></tr>
</table>

**只要**在创建执行上下文的时候，**就**会同步创建相应的词法环境。所以每一类符合执行上下文创建的条件的时候，所创建的执行上下文一定会携带有属于他自己的词法环境。

> 💡 **重要**
> ps：闭包的定义中的 lexical environment 即是这里
> 闭包（closure）是一个函数以及其捆绑的周边环境状态（lexical environment，词法环境）的引用的组合。换而言之，闭包让开发者可以从内部函数访问外部函数的作用域。在 JavaScript 中，闭包会随着函数的创建而被同时创建。

## 词法环境的组成部分

### 环境记录项（ Environment Record ）

先来看看 ECMA 规范中的定义

> There are two primary kinds of Environment Record values used in this specification: _declarative Environment Records_ and _object Environment Records_. Declarative Environment Records are used to define the effect of ECMAScript language syntactic elements such as _FunctionDeclarations_, _VariableDeclarations_, and _Catch_ clauses that directly associate identifier bindings with [ECMAScript language values](https://262.ecma-international.org/6.0/#sec-ecmascript-language-types). Object Environment Records are used to define the effect of ECMAScript elements such as _WithStatement_ that associate identifier bindings with the properties of some object. [Global Environment Records](https://262.ecma-international.org/6.0/#sec-global-environment-records) and function Environment Records are specializations that are used for specifically for _Script_ global declarations and for top-level declarations within functions.
> 本规范中使用的环境记录值主要有两种：_声明性环境记录_和_对象环境记录_。声明性环境记录用于定义 ECMAScript 语言语法元素的效果，例如_FunctionDeclarations_，_VariableDeclarations_和_Catch_子句，这些语句直接将标识符绑定与 [ECMAScript 语言值相](https://262.ecma-international.org/6.0/#sec-ecmascript-language-types)关联。对象环境记录用于定义 ECMAScript 元素（如_WithStatement）_的效果，这些元素将标识符绑定与某些对象的属性相关联。[全局环境记录](https://262.ecma-international.org/6.0/#sec-global-environment-records)和函数环境记录是专门用于_脚本_全局声明和函数中的顶级声明的专门化。
> For specification purposes Environment Record values are values of the Record specification type and can be thought of as existing in a simple object-oriented hierarchy where Environment Record is an abstract class with three concrete subclasses, declarative Environment Record, object Environment Record, and global Environment Record. [Function Environment Records](https://262.ecma-international.org/6.0/#sec-function-environment-records) and module Environment Records are subclasses of declarative Environment Record. The abstract class includes the abstract specification methods defined in [Table 15](https://262.ecma-international.org/6.0/#table-15). These abstract methods have distinct concrete algorithms for each of the concrete subclasses.
> 环境记录值是记录规范类型的值，可以被认为存在于一个简单的面向对象的层次结构中，其中环境记录是一个抽象类，有三个具体的子类，声明性环境记录，对象环境记录和全局环境记录。[函数环境记录](https://262.ecma-international.org/6.0/#sec-function-environment-records)和模块环境记录是声明性环境记录的子类。抽象类包括[表 15](https://262.ecma-international.org/6.0/#table-15) 中定义的抽象规范方法。这些抽象方法对每个具体子类都有不同的具体算法。

总结一下：环境记录项就是为了记录**当前**执行上下文中都有哪些变量。一共有五种环境记录项的类别，分别对应到上面的执行上下文的类别就是下面这样

- `declarative Environment Record`（声明式环境记录项）：**try...catch** **IsDebugEvaluateContext** **IsAwaitContext** **IsBlockContext** **IsBlockContext**

  - `function Environment Record`（函数式环境记录项）：**IsFunctionContext**** **
  - `module Environment Record`（模块式环境记录项）：**IsModuleContext**
- `object Environment Record`（对象式环境记录项）：**IsWithContext**
- `global Environment Record`（全局式环境记录项）：**NativeContext**

#### 声明式环境记录项

> Each declarative [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) is associated with an ECMAScript program scope containing variable, constant, let, class, module, import, and/or function declarations. A declarative [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) binds the set of identifiers defined by the declarations contained within its scope.
> 每个声明性[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)都与包含变量、常量、let、类、模块、导入和/或函数声明的 ECMAScript 程序范围相关联。声明性[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)绑定由其范围内包含的声明定义的标识符集。

**适用场景**：用于存储函数参数、局部变量、`let` 和 `const` 声明的变量，以及函数声明。

**结构特点**：直接在内存中管理这些变量和标识符的绑定，确保对块级和函数内部变量的快速访问。

#### 函数式环境记录项

> A function [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) is a declarative [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) that is used to represent the top-level scope of a function and, if the function is not an _ArrowFunction_, provides a **this** binding. If a function is not an _ArrowFunction_ function and references **super**, its function [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) also contains the state that is used to perform **super** method invocations from within the function.
> 函数[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)是一个声明性[的环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)，用于表示函数的顶级范围，如果函数不是_ArrowFunction_，则提供 **this** 绑定。如果一个函数不是_ArrowFunction_函数并且引用了 **super**，那么它的函数 [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) 也包含了用于从函数内部执行 **super** 方法调用的状态。

**适用场景**：用于函数的执行上下文。

**扩展特性**：继承自 `Declarative Environment Record`，并增加了对 `this` 绑定的处理，以及对函数参数的特殊管理。

#### 模块式环境记录项

> A module [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) is a declarative [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) that is used to represent the outer scope of an ECMAScript _Module_. In additional to normal mutable and immutable bindings, module Environment Records also provide immutable import bindings which are bindings that provide indirect access to a target binding that exists in another Environment Record.
> 模块[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)是一个声明性[的环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)，用于表示 ECMAScript_模块_的外部范围。除了正常的可变和不可变绑定之外，模块环境记录还提供不可变的导入绑定，这些绑定提供对存在于另一个环境记录中的目标绑定的间接访问。

**适用场景**：用于模块的顶层作用域。

**扩展特性**：继承自 `Declarative Environment Record`，并增加了管理模块导入和导出的能力，确保模块作用域内的变量绑定正确处理。

#### 对象式环境记录项

> Each object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) is associated with an object called its _binding object_. An object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) binds the set of string identifier names that directly correspond to the property names of its binding object. Property keys that are not strings in the form of an _IdentifierName_ are not included in the set of bound identifiers. Both own and inherited properties are included in the set regardless of the setting of their [[Enumerable]] attribute. Because properties can be dynamically added and deleted from objects, the set of identifiers bound by an object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) may potentially change as a side-effect of any operation that adds or deletes properties. Any bindings that are created as a result of such a side-effect are considered to be a mutable binding even if the Writable attribute of the corresponding property has the value **false**. Immutable bindings do not exist for object Environment Records.
> 每个对象[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)都与一个称为其_绑定对象的_对象相关联。对象[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)绑定与其绑定对象的属性名称直接对应的字符串标识符名称集。不是_IdentifierName_形式的字符串的属性键不包括在绑定标识符集中。所有的和继承的属性都包含在集合中，而不管它们的[[EQUIPMENT]]属性的设置如何。由于可以动态地添加和删除对象的属性，因此对象[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)绑定的标识符集可能会作为添加或删除属性的任何操作的副作用而发生更改。由于这种副作用而创建的任何绑定都被认为是可变绑定，即使相应属性的可验证属性的值为 **false**。 对象环境记录的不可变绑定不存在。

**适用场景**：用于 `with` 语句和全局对象。

**结构特点**：将对象属性作为环境记录中的标识符绑定，使得对象的属性可以像变量一样被访问。这些绑定并不直接在内存中存储，而是通过对象的属性进行动态查找。

#### 全局式环境记录项

> A global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) is used to represent the outer most scope that is shared by all of the ECMAScript _Script_ elements that are processed in a common [Realm](https://262.ecma-international.org/6.0/#sec-code-realms) ([8.2](https://262.ecma-international.org/6.0/#sec-code-realms)). A global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) provides the bindings for built-in globals ([clause 18](https://262.ecma-international.org/6.0/#sec-global-object)), properties of the global object, and for all top-level declarations ([13.2.8](https://262.ecma-international.org/6.0/#sec-block-static-semantics-toplevellexicallyscopeddeclarations), [13.2.10](https://262.ecma-international.org/6.0/#sec-block-static-semantics-toplevelvarscopeddeclarations)) that occur within a _Script_.
> 全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)用于表示在公共[领域](https://262.ecma-international.org/6.0/#sec-code-realms)（[8.2](https://262.ecma-international.org/6.0/#sec-code-realms)）中处理的所有 ECMAScript_脚本_元素共享的最外部范围。全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)为内置全局变量（[第 18 条](https://262.ecma-international.org/6.0/#sec-global-object)）、全局对象的属性以及_脚本_中出现的所有顶级声明（[13.2.8](https://262.ecma-international.org/6.0/#sec-block-static-semantics-toplevellexicallyscopeddeclarations)，[13.2.10](https://262.ecma-international.org/6.0/#sec-block-static-semantics-toplevelvarscopeddeclarations)）提供绑定。
> A global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) is logically a single record but it is specified as a composite encapsulating an object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) and a declarative [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records). The object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) has as its base object the global object of the associated [Realm](https://262.ecma-international.org/6.0/#sec-code-realms). This global object is the value returned by the global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records)’s GetThisBinding concrete method. The object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) component of a global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) contains the bindings for all built-in globals ([clause 18](https://262.ecma-international.org/6.0/#sec-global-object)) and all bindings introduced by a _FunctionDeclaration_, _GeneratorDeclaration_, or _VariableStatement_ contained in global code. The bindings for all other ECMAScript declarations in global code are contained in the declarative [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) component of the global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records).
> 全局[环境记录在](https://262.ecma-international.org/6.0/#sec-environment-records)逻辑上是单个记录，但它被指定为封装对象[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)和声明性[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)的组合。对象 [EnvironmentRecord](https://262.ecma-international.org/6.0/#sec-environment-records) 将关联[领域](https://262.ecma-international.org/6.0/#sec-code-realms)的全局对象作为其基础对象。这个全局对象是由全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)的 GetThisBinding 具体方法返回的值。全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)的对象[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)组件包含所有内置全局变量（[第 18 条](https://262.ecma-international.org/6.0/#sec-global-object)）的绑定以及全局代码中包含的_FunctionDeclaration_、_GeneratorDeclaration_或_VariableStatement_引入的所有绑定。全局代码中所有其他 ECMAScript 声明的绑定都包含在全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)的声明性[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)组件中。
> Properties may be created directly on a global object. Hence, the object [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) component of a global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) may contain both bindings created explicitly by _FunctionDeclaration_, _GeneratorDeclaration_, or _VariableDeclaration_ declarations and binding created implicitly as properties of the global object. In order to identify which bindings were explicitly created using declarations, a global [Environment Record](https://262.ecma-international.org/6.0/#sec-environment-records) maintains a list of the names bound using its CreateGlobalVarBindings and CreateGlobalFunctionBindings concrete methods.
> 可以直接在全局对象上创建属性。因此，全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)的对象[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)组件可以包含由_FunctionDeclaration_、_GeneratorDeclaration_或_VariableDeclaration_声明显式创建的绑定以及作为全局对象的属性隐式创建的绑定。为了标识哪些绑定是使用声明显式创建的，全局[环境记录](https://262.ecma-international.org/6.0/#sec-environment-records)维护了一个使用其 GlobalVarBindings 和 GlobalFunctionBindings 具体方法绑定的名称列表。

**适用场景**：用于全局作用域。

**结构特点**：是 `Object Environment Record` 的一种特化，负责管理全局对象和全局变量、全局函数的绑定。这些绑定是对全局对象属性的引用。

### 外部词法环境（ outer Lexical Environment ）

因为词法环境是对应执行上下文中唯一一个用来查找变量的功能部分。然而本身的环境记录中又只能存放当前作用域下的新定义的变量，所以我们还需要一种方式去向上查找更上一级的环境记录，所以就还会有外部词法环境这一个引用。用来构成完整的作用域链，直到全局上下文。

## 词法环境是如何工作的

### 报错

当我们一段代码对应的执行上下文中需要声明或者保存变量的时候，就会从 LexicalEnvironment 部分找到真正对应的词法环境，然后先在环境记录项中查找是否有这个变量的声明。如果没有，则从当前词法环境对应的 outer Lexical Environment 向上查找，直到全局词法环境。如果在这途中全都没有找到相关声明，就会抛出错误 Uncaught ReferenceError

{% asset_img "MDx8bMoGcojIkUxXVRMcpSXVnJe.png" "" %}

### 闭包

当我们**当前的**执行上下文对应的词法环境的**环境记录项**中找不到变量的时候，需要向上查找。**一旦有这个行为**，在这个时候就已经形成了闭包（Closure）。如果对应的执行上下文对应的代码在后面还会有被调用的可能，即他还会有在将来的某一个时候被调用的可能或者被提升到全局作用域中。则它对应的闭包相关的词法环境就会被保存，防止在后面应该执行的时候找不到里面的内容。

### 回收

当我们的词法环境对应的执行上下文被销毁了，也就是对应的代码执行完毕了。如果在外部找不到任何可能让这个词法环境还会被调用。这些资源就会被 GC 给彻底销毁。

## 词法环境在浏览器前端里面是否有实例

答案也是肯定的，和执行上下文在一起。浏览器开发者控制台 -> 源代码/来源 -> 作用域

> 在这个 作用域 板块中，如果当前的词法环境中没有新的变量被定义，在这个板块中会被省略。因为代码如果复杂起来会有很多层的作用域互相嵌套，如果把所有的嵌套层级都展示出来，可能就会有很多空的子项，这并不利于我们去调试和查看。所以会被省略不写

{% asset_img "CPBObmpngojsU3xGltwcRu88nIb.png" "" %}

里面有很多可以展开或者收起的子项，最顶层的项就是当前执行上下文对应的词法环境。下面每一项依次就是 outer Lexical Environment ，直到全局词法环境

# 实例

用下面的代码作为例子，用上面所讲的模型来直观地看一下代码执行都经过了什么

```javascript
let closure

const promise = new Promise((_resolve_) => {
    resolve('I am a promise')
})

function main() {
    closure = outerFunction()
    closure()
}

function outerFunction() {
    let outerVar = 'I am outside'
    
    function innerFunction() {
        console.log(outerVar)
    }
    
    _return_ innerFunction
} 

promise.then((_res_) => {
    console.log(_res_)
})

main()
```

{% asset_img "image(1).png" "" %}

{% asset_img "image(2).png" "" %}

{% asset_img "image(3).png" "" %}
