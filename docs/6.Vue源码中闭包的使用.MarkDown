## 什么是闭包

先上一个MDN上闭包的官方解释：<br>
[什么是闭包](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Closures)

根据《JavaScript权威指南》中的定义，
> 函数对象可以通过作用域链相互联系起来，函数体内部的变量都可以保存在函数作用域内，这种特性在计算机科学文献中称为“闭包”。

因此，闭包是由函数和环境共同构成的，缺一不可，即便在函数内部定义了函数，但是如果没有引用父函数作用域的变量，也同样不是闭包。

由于javascript中作用链的规定，子函数可以访问父函数中的变量，比如以下代码:
```javascript
var value = 1
function Outer () {
  console.log(value)
}
Outer() // 1
```
但是不能在父函数中对子函数内的变量进行访问:
```javascript
function Outer () {
  var value = 1
}
console.log(value) // undefined
```
如何能够获得子函数中的变量呢？这时候闭包就派上用场了。在Outer中return出高阶函数，即可在外部获取内部的局部变量。
```javascript
function Outer() {
  // outer return出来一个函数
  var value = 1
  return function inner() {
      return value
  }
}
var func = Outer()
console.log(func()) // 输出1
```
由于在inner中可以访问到outer中的变量，因此，可以把value保存在inner中，return出来，就可以在外层获得outer中的value。

再看另外一个例子:
```javascript
function outer () {
    var value = 1
    return function inner () {
        console.log(value++)
    }
}
var result = outer()
result() // 1
result() // 2
```
以上代码的执行结果就有点古怪，为什么第二次调用`result()`的时候不是返回1而是返回2呢？详细剖析一下：
- 执行outer，返回inner, 赋值给变量result;
- 执行result(), 查找inner中有没有value, 发现没有，就沿着作用域链向上找；
- 到达outer()的作用域，找到value, 此时value是1, 因此返回1；同时运行value++, value变成了2;
- 在执行第二次`result()`的时候，由于闭包始终在内存中，不会被垃圾回收机制销毁，此时在inner中保存的value是2，因此返回2

不过由于闭包会使得函数中的变量都被保存在内存中，内存消耗很大，所以不能滥用闭包，否则会造成网页的性能问题。

## vue-src中闭包的使用

在vue源码中，闭包的使用真的非常多。都是利用了闭包会将函数的活动对象维持在内存中的特点，因此可以使用闭包做缓存策略。比如以下的代码：
```javascript
export function cached<F: Function> (fn: F): F {
  const cache = Object.create(null)
  return (function cachedFn (str: string) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }: any)
}
```
调用这个函数的时候传入一个方法：
```javascript
/**
 * Capitalize a string.
 */
 /*首字母转大写*/
export const capitalize = ((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

const cacheFk = cached(capitalize)
// 1 step
cacheFk('aAA')
// 2 step
cacheFk('aAA')
```
以上代码执行的时候是这样的过程:
- 1 step: 执行`cacheFk('aAA')`得到结果AAA，由于是第一次调用`cacheFk('aAA')`方法，执行的是`capitalize(str)`，并且把这个结果放在cache里，由于是闭包会放在内存里，不会被清理掉；
- 2 step: 再调用`cacheFk('aAA')`, 可以直接取cache['aAA'], 就不需要再去执行capitalize，于是加快了数据的读取速度。
