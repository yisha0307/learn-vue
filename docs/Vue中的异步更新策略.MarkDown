## 异步更新队列

引用下vue.js官方教程关于vue中异步更新队列的解释：
> 可能你还没有注意到，Vue 在更新 DOM 时是异步执行的。只要侦听到数据变化，Vue 将开启一个队列，并缓冲在同一事件循环中发生的所有数据变更。如果同一个 watcher 被多次触发，只会被推入到队列中一次。这种在缓冲时去除重复数据对于避免不必要的计算和 DOM 操作是非常重要的。然后，在下一个的事件循环“tick”中，Vue 刷新队列并执行实际 (已去重的) 工作。Vue 在内部对异步队列尝试使用原生的 Promise.then、MutationObserver 和 setImmediate，如果执行环境不支持，则会采用 setTimeout(fn, 0) 代替。

为什么要这么做呢？来看一个简单的例子：
```html
<template>
  <div>
    <div>{{test}}</div>
  </div>
</template>

```

```javascript
export default {
    data () {
        return {
            test: 0
        };
    },
    mounted () {
      for(let i = 0; i < 1000; i++) {
        this.test++;
      }
    }
}
```
根据mounted里的代码，test一共被触发了1000次，如果不是异步更新，watcher在被触发1000次时，每次都会去更新视图，这是非常非常消耗性能的。因此，vue才会采用异步更新的操作，如果同一个 watcher 被多次触发，只会被推入到队列中一次。然后在下一次事件循环'tick‘的时候，只需更新一次dom即可。

我们来看一下watcher类中的update方法，了解下具体这个异步更新代码是如何实现的。
```javascript
update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      /*同步则执行run直接渲染视图*/
      // 基本不会用到sync
      this.run()
    } else {
      /*异步推送到观察者队列中，由调度者调用。*/
      queueWatcher(this)
    }
  }
export function queueWatcher (watcher: Watcher) {
  /*获取watcher的id*/
  const id = watcher.id
  /*检验id是否存在，已经存在则直接跳过，不存在则标记哈希表has，用于下次检验*/
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      /*如果没有flush掉，直接push到队列中即可*/
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i >= 0 && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(Math.max(i, index) + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
```
我们可以看到，watcher在update时候，调用了一个queueWatcher的方法，将watcher异步推送到观察者队列中；调用queueWatcher的时候，首先查看了watcher的id，保证相同的watcher不被多次推入；waiting是一个标识，如果没有在waiting, 就异步执行flushSchedulerQueue方法。

## flushSchedulerQueue

flushSchedulerQueue是下一个tick的时候的回调函数，主要就是去执行watcher中的run方法。看一下源码：
```javascript
/*nextTick的回调函数，在下一个tick时flush掉两个队列同时运行watchers*/
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  /*
    给queue排序，这样做可以保证：
    1.组件更新的顺序是从父组件到子组件的顺序，因为父组件总是比子组件先创建。
    2.一个组件的user watchers比render watcher先运行，因为user watchers往往比render watcher更早创建
    3.如果一个组件在父组件watcher运行期间被销毁，它的watcher执行将被跳过。
  */
 // queue: Array<Watcher>
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    /*将has的标记删除*/
    has[id] = null
    /*执行watcher*/
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  /**/
  /*得到队列的拷贝*/
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  /*重置调度者的状态*/
  resetSchedulerState()

  // call component updated and activated hooks
  /*使子组件状态都改编成active同时调用activated钩子*/
  callActivatedHooks(activatedQueue)
  /*调用updated钩子*/
  callUpdateHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}
```

## 操作真实DOM

这时候我们再来看一下vue中文教程里的代码:
```html
<div id="example">{{message}}</div>
```
```javascript
var vm = new Vue({
  el: '#example',
  data: {
    message: '123'
  }
})
vm.message = 'new message' // 更改数据
vm.$el.textContent === 'new message' // false
Vue.nextTick(function () {
  vm.$el.textContent === 'new message' // true
})
```
当设置`vm.message = 'new message'`时候，该组件并不会立即进行渲染，而是在dep.notify了watcher之后，被异步推到了调度者队列中，等到nextTick的时候进行更新。nextTick则是会去尝试原生的Promise.then和MutationObserver，如果都不支持，最差会采用setTimeout(fn, 0)进行异步更新。所以如果想基于更新后的DOM状态做点什么，可以在数据变化之后立即使用Vue.nextTick(callback)对真实DOM进行操作。
