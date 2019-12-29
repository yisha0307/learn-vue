## 真实DOM的操作过程

首先复习一下真实DOM的解析和渲染过程。<br>
浏览器的渲染机制主要有以下几步： **创建DOM树——创建StyleRules——创建Render树——布局Layout——绘制Painting**
1. 用HTML分析器，分析HTML元素，构建DOM树；
2. 用css分析器，分析style文件和元素上的inline样式，生成样式表;
3. 将DOM树和样式表结合起来，每个DOM都有一个attach方法，接受了相应的样式信息，返回一个render树。
4. 有了render树之后，就可以确定每一个节点在显示器的精确定位（Layout步骤）;
5. render树和每个节点的坐标也都有了，调用每个节点的paint节点，把它们绘制出来。

![](https://upload-images.jianshu.io/upload_images/4345378-b7ccad3bc808783f.png?imageMogr2/auto-orient/strip|imageView2/2/w/624/format/webp)

可以看到，操作真实DOM的步骤很多，计算真实DOM的坐标点很复杂，虽然我们现在的计算机更新迭代很快，但是DOM的代价仍然是昂贵的，频繁操作还是会出现页面卡顿，影响用户体验。

## Virtual DOM以及VNODE

虚拟DOM是一个JS对象，可以模拟真实的DOM节点。好处就是数据更新的时候，不需要经过解析和渲染真实DOM的五个步骤，只要将更新的diff反应到这个js对象中就好了。操作JS肯定会比操作DOM来得快得多，避免了许多计算量，等更新完成后，再将最终的virtual DOM映射成真实的DOM即可。

vue.js里的virtual DOM称之为VNODE节点，源码可见vue-src/core/vdom中class VNode的定义。

举个栗子，virtual DOM的JS对象（也称之为VNODE), 基本上是这样的：
```javascript
{
    tag: 'div'
    data: {
        class: 'test'
    },
    children: [
        {
            tag: 'span',
            data: {
                class: 'demo'
            }
            text: 'hello,VNode'
        }
    ]
}
```
当中定义了这个节点的tagName是div, className是test, 有个span子节点，className是demo, text是`hello, VNODE`, 所以映射到真实dom是这样的:
```html
<div class="test">
    <span class="demo">hello,VNode</span>
</div>
```

## update视图

复习一下上一节[Vue的双向绑定原理](./1.Vue的双向绑定原理.MarkDown)中的内容，视图的更新主要是通过Observer绑定数据后，一旦data有所更新，set方法会调用对应dep的notify(), 通知watchers进行update。watcher需要调用get方法得到value值, 而expOrFn这个string | Function参数, 是实例化watcher类的时候决定watcher.get()的结果的要素(具体可参见上一节中watcher的代码)。<br>

之后我们找一下实例化watcher的代码，于是找到了mountComponent这个方法（其实就是挂载组件的方法，如上一节的图上所示，在第一次挂载组件的时候就会touch data，收集依赖，绑定上watcher），就可以看到这个expOrFn到底是什么。（同样省略了很多与本节讨论不相关的代码）
```javascript
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // ...
  // 省略以上代码
  /*updateComponent作为Watcher对象的getter函数，用来依赖收集*/
  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    // blablabla
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  /*这里对该vm注册一个Watcher实例，Watcher的getter为updateComponent函数，用于触发所有渲染所需要用到的数据的getter，进行依赖收集，该Watcher实例会存在所有渲染所需数据的闭包Dep中*/
  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false
    // 省略以下代码
    // ...
```
所以说，Watcher其实是通过get方法执行了`vm._update(vm._render(), hydrating)`。

于是看一下_update方法：

```JavaScript
Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    /*如果已经该组件已经挂载过了则代表进入这个步骤是个更新的过程，触发beforeUpdate钩子*/
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    /*基于后端渲染Vue.prototype.__patch__被用来作为一个入口*/
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    /*更新新的实例对象的__vue__*/
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }
```
可以看到，_update最重点的方法，就是去调用了__patch__。如果是第一次render，vm.$el就是`vm.__patch__(vm.$el, vnode, hydrating, false, vm.$options._parentElm, vm.$options._refElm)`; 如果是update, vm.$el就等于`vm.__patch__(prevVnode, vnode)`.

接下来我们就来研究下什么是__patch__。

## __patch__和sameVnode判定

在vue.js里，__patch__的作用其实是将新老节点进行一个比较，然后将两者的比较结果进行最小程度地修改视图，而不是将整个视图根据新的vnode进行重绘。因此，在__patch__里，其实就是vue的diff算法，diff算法是通过同层的树节点进行比较而非对树进行逐层搜索遍历的方式，所以时间复杂度只有O(n)，是一种相当高效的算法。

diff算法的核心是，当oldVnode与vnode在sameVnode的时候才会进行patchVnode，也就是新旧VNode节点判定为同一节点的时候才会进行patchVnode这个过程，否则就是创建新的DOM，移除旧的DOM。

那么什么样的节点才算是sameNode呢？
```JavaScript
/*
  判断两个VNode节点是否是同一个节点，需要满足以下条件
  key相同
  tag（当前节点的标签名）相同
  isComment（是否为注释节点）相同
  是否data（当前节点对应的对象，包含了具体的一些数据信息，是一个VNodeData类型，可以参考VNodeData类型中的数据信息）都有定义
  当标签是<input>的时候，type必须相同
*/
function sameVnode (a, b) {
  return (
    a.key === b.key &&
    a.tag === b.tag &&
    a.isComment === b.isComment &&
    isDef(a.data) === isDef(b.data) &&
    sameInputType(a, b)
  )
}
// Some browsers do not support dynamically changing type for <input>
// so they need to be treated as different nodes
/*
  判断当标签是<input>的时候，type是否相同
  某些浏览器不支持动态修改<input>类型，所以他们被视为不同节点
*/
function sameInputType (a, b) {
  if (a.tag !== 'input') return true
  let i
  const typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type
  const typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type
  return typeA === typeB
}
```
因此我们可以得出结论，只有a和b两个节点的key、tagName都相同，且同为注释节点或者同不为注释节点，且data都有定义，且如果tagName是input的时候，input的type也相同的时候，才能说a和b是sameVnode。

这就是为什么我们在用v-for的时候需要传入key，并且key推荐用id或者name之类独一无二并且可以与节点对应起来的值，而不是index这种和节点数据其实没关系的值。

在a、b判定是sameVnode的时候，就会去进行patchVnode操作.

因为patchVnode和diff算法在[染陌同学](https://github.com/answershuto)的[VirtualDOM与diff(Vue实现)](https://github.com/answershuto/learnVue/blob/master/docs/VirtualDOM%E4%B8%8Ediff(Vue%E5%AE%9E%E7%8E%B0).MarkDown)中已经很详细了，我这边就不赘述了，大家可移步学习。

