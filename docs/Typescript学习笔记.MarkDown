## 关于Typescript

众所周知，javascript是一门动态语言，和java这种静态语言最大的不同就是允许改变变量的数据类型。比如在js里定义一个`var a = 123`, 这个时候a是一个Number，如果再执行`a = [1,2,3]`, a就变成了一个Array, 这在js里是完全可以的，但是在JAVA这种一开始就会定义a的数据类型的静态语言中却是行不通的。动态语言有他的好处，就是写起来比较灵活，但是缺点也很明显，由于对数据类型没有检查，常常会导致bug。这个时候，typescript就出现了。

> TypeScript是一种由微软开发的自由和开源的编程语言。它是JavaScript的一个超集，而且本质上向这个语言添加了可选的静态类型和基于类的面向对象编程。

由于vue的源码几乎都是用typeScript写的，所以在学习vue-src的时候，我也去学习了ts。更重要的是，目前vue3已经出了pre-alpha version, 在vue3里会全面支持ts，所以学习typeScript就有很大的好处。

本文会根据源码中的一些ts写法对typeScript进行介绍，系统的学习ts可以参考[Typescript入门教程](https://ts.xcatliu.com/)。

## TypeScript特性

**基础类型**

Typescript中包含了**boolean / number / string / object / Array / 元组 / 枚举 / any / Undefined / Null / Void / Never**

举个栗子，在vue-src里随处可见的类型检查：
```javascript
export function remove (arr: Array<any>, item: any): Array<any> | void {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}
```
remove这个函数接受两个参数arr和item, arr是数组，且数组内的元素可以是任意类型(any)，而item也可以是任意类型，且返回值可以是数组也可以是空值(`|`代表或的关系，称之为”联合类型“)。

再比如vnode的代码：
```javascript
export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  functionalContext: Component | void; // only for functional component root nodes
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions
  ) {
    /*当前节点的标签名*/
    this.tag = tag
    // 省略了各类属性的定义
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}
```
可以看到，VNode类在最开始就对this的各类属性进行了类型声明.

**高级类型**
大部分情况是对object类型做更细的标注, 主要使用interface（接口），除了可用于对类的一部分行为进行抽象以外，也常用于对「对象的形状（Shape）」进行描述。

interface的简单例子：
```javascript
interface Person {
    name: string;
    age: number;
}

let tom: Person = {
    name: 'Tom',
    age: 25
};
```
在上面的代码中，定义了一个接口Person, 接着定义了一个变量tom，它的类型是Person。这样，我们就约束了tom的形状必须和接口Person一致。如果tom中少了某个属性或者多了某个属性，都是不允许的。

如果有些属性我们并不确定是不是一定有，可以用?表示可选属性:
```javascript
interface Person {
    name: string;
    age?: number;
}

let tom: Person = {
    name: 'Tom'
}; // true
```
如果我们允许在interface上添加一些未知属性，可以使用:
```javascript
interface Person {
    name: string;
    age?: number;
    [propName: string]: any;
}

let tom: Person = {
    name: 'Tom',
    gender: 'male'
};
```
上面的代码中，我们定义了一个string类型的propName, 它的类型可以是任意属性any.

看一个vue-src里的例子:
```javascript
interface ISet {
  has(key: string | number): boolean;
  add(key: string | number): mixed;
  clear(): void;
}
```
而在使用这个interface的时候：
```javascript
class Set implements ISet {
    set: Object;
    constructor () {
      this.set = Object.create(null)
    }
    has (key: string | number) {
      return this.set[key] === true
    }
    add (key: string | number) {
      this.set[key] = true
    }
    clear () {
      this.set = Object.create(null)
    }
}
```
补充说明一下, `implements`（实现）是面向对象中的一个重要概念。
> 一般来讲，一个类只能继承自另一个类，有时候不同类之间可以有一些共有的特性，这时候就可以把特性提取成接口（interfaces），用 implements 关键字来实现。这个特性大大提高了面向对象的灵活性。
                       ----- 《Typescript》入门教程

在上面的代码中，ISet这个interface定义了has、add、clear三个方法，而Set类实现了ISet，定义了这三个方法。

## 泛型

举个源码中的例子(因为vue2里泛型几乎没用到，这边举的例子是vue3的，来自尤大的[vue-next](https://github.com/vuejs/vue-next)工程)：
```javascript
function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1]
}
```
这个方法的意思就是传入一个数组（但是数组的每个值并不清楚是什么类型），返回该数组的最后一个值。

这样我们就有个概念了，所谓泛型（Generics），是指在定义函数、接口或类的时候，不预先指定具体的类型，而在使用的时候再指定类型的一种特性。

上例中，我们在函数名后添加了`<T>`，其中`T`用来指代任意输入的类型，在后面的输入`(xs: T[])`和输出T或者undefined即可使用了。接着在调用的时候，可以指定它具体的类型为 string。类型自动就会推算出来T的类型。

再来一段高级点的代码，同样出自vue3：
```javascript
export function withScopeId(id: string): <T extends Function>(fn: T) => T {
  if (__BUNDLER__) {
    return ((fn: Function) => {
      return function(this: any) {
        pushScopeId(id)
        const res = fn.apply(this, arguments)
        popScopeId()
        return res
      }
    }) as any
  } else {
    return undefined as any
  }
}
```
这段代码同样使用了泛型，但是对泛型进行了约束，只允许传进来的fn继承自Function。当然也可以自定义interface, 比如(例子来自[typescript入门教程 - 泛型](https://ts.xcatliu.com/advanced/generics)):
```javascript
interface Lengthwise {
  length: number
}
function loggingIdentity<T extends Lengthwise> (arg: T): T {
  console.log(arg.length)
  return arg
}
```
这就保证了泛型T必须符合interface Lengthwise的形状，也就是会有length属性。

## 零零碎碎

#### 数组的不同表示方法
1. `let fibonacci: number [] = [1, 1, 2, 3, 5]`
2. `let fibonacci: Array<number> = [1, 1, 2, 3, 5]`

#### 元组和数组的不同
数组合并了相同类型的对象，而元组（Tuple）合并了不同类型的对象。也就是数组里的每一个值都必须是同一个数据类型，但是元组无所谓.

比如:
```javascript
// 数组
let tom: number[] = [1, '2'] // error

// 元组
let tom: [number, string] = [1, '2'] // passed
```

#### 断言
断言有两种语法，分别是`<类型>值`或者`值 as 类型`。在tsx中，只能使用后一种。
比如vue3中：
```javascript
export function provide<T>(key: InjectionKey<T> | string, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    let provides = currentInstance.provides
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    // TS doesn't allow symbol as index type
    provides[key as string] = value
  }
}
```
断言适用于确实需要在还不确定类型的时候就访问其中一个类型的属性或方法，比如上例中，`key as string`就是讲key断言成了string类型。之后key就可以按照string类型使用string的一些方法。

要注意的是，**类型断言不是类型转换，断言成一个联合类型中不存在的类型是不允许的**。

