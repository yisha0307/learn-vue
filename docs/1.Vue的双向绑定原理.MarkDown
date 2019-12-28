## 数据绑定原理

正如尤大在vue的教程[深入响应式原理](https://cn.vuejs.org/v2/guide/reactivity.html)里写的那样，Vue内部主要靠劫持Object.defineProperty()的getter和setter方法，在每次get数据的时候注入依赖，在set数据的时候发布消息给订阅者，从而实现DOM的更新。因为Object.defineProperty()没有办法在IE8或者更低版本的浏览器中实现，所以Vue是不能支持这些浏览器的。

看一下官网提供的图片：

![](https://cn.vuejs.org/images/data.png)

在组件渲染操作的时候("Touch"), 触发Data中的getter（会保证只有用到的data才会触发依赖，看了源码之后，其实是每一个Data的key对应的value都会有一个Dep, 收集一组`subs<Array: Watcher>`），在更新数据的时候，触发setter, 通过Dep.notify()通知所有的subs进行更新，watcher又通过回调函数通知组件进行更新，通过virtual DOM和diff计算实现optimize, 完成re-render。

在整个源码当中，比较重要的几个概念就是Observer/Dep/Watcher。下面主要分析一下这三类的处理。

## Observer

Observer的作用是对整个Data进行监听，在initData这个初始方法里使用`observe(data)`,Observer类内部通过defineReactive方法劫持data的每一个属性的getter和setter。看一下源码：

```javascript
export function observe (value: any, asRootData: ?boolean): Observer | void {
  /*判断Data是否是一个对象*/
  if (!isObject(value)) {
    return
  }
  let ob: Observer | void

  /*这里用__ob__这个属性来判断是否已经有Observer实例，如果没有Observer实例则会新建一个Observer实例并赋值给__ob__这个属性，如果已有Observer实例则直接返回该Observer实例*/
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    /*这里的判断是为了确保value是单纯的对象，而不是函数或者是Regexp等情况。*/
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建一个Observer实例，绑定data进行监听
    ob = new Observer(value)
  }
  if (asRootData && ob) {

    /*如果是根数据则计数，后面Observer中的observe的asRootData非true*/
    ob.vmCount++
  }
  return ob
}
```

Vue的响应式数据都会有一个__ob__作为标记，里面存放了Observer实例，防止重复绑定。

再看一下Observer类的源码:

```javascript
/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
export class  {
  value: any;
  dep: Dep; // 每一个Data的属性都会绑定一个dep，用于存放watcher arr
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0

    /*
        /vue-src/core/util/lang.js:
        function def (obj: Object, key: string, val: any, enumerable?: boolean) {
            Object.defineProperty(obj, key, {
                value: val,
                enumerable: !!enumerable,
                writable: true,
                configurable: true
            })
        }
    */
    def(value, '__ob__', this) // 这个def的意思就是把Observer实例绑定到Data的__ob__属性上去
    if (Array.isArray(value)) {

      /*
          如果是数组，将修改后可以截获响应的数组方法替换掉该数组的原型中的原生方法，达到监听数组数据变化响应的效果。
      */
      const augment = hasProto
        ? protoAugment  /*直接覆盖原型的方法来修改目标对象*/
        : copyAugment   /*定义（覆盖）目标对象或数组的某一个方法*/
      augment(value, arrayMethods, arrayKeys)
      /*Github:https://github.com/answershuto*/
      /*如果是数组则需要遍历数组的每一个成员进行observe*/
      this.observeArray(value)
    } else {
      /*如果是对象则直接walk进行绑定*/
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)

    /*
    walk方法会遍历对象的每一个属性进行defineReactive绑定
    defineReactive: 劫持data的getter和setter
    */
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    /*
    数组需要遍历每一个成员进行observe
    */
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}
```
可以看到，Observer类主要干了以下几件事：
- 给data绑定一个__ob__属性，用来存放Observer实例，避免重复绑定
- 如果data是Object, 遍历对象的每一个属性进行defineReactive绑定
- 如果data是Array, 则需要对每一个成员进行observe。vue.js会重写Array的push、pop、shift、unshift、splice、sort、reverse这7个方法，保证之后pop/push等操作进去的对象也有进行双向绑定. (具体代码参见[observer/array.js](https://github.com/vuejs/vue/blob/dev/src/core/observer/array.js))

## defineReactive()

如上述源码所示，Observer类主要是靠遍历data的每一个属性，使用defineReactive()方法劫持getter和setter方法, 下面来具体看一下defineReactive:

```javascript
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: Function
) {
  /*在闭包中定义一个dep对象*/
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  /*如果之前该对象已经预设了getter以及setter函数则将其取出来，新定义的getter/setter中会将其执行，保证不会覆盖之前已经定义的getter/setter。*/
  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set

  /*对象的子对象也会进行observe*/
  let childOb = observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      /*如果原本对象拥有getter方法则执行*/
      const value = getter ? getter.call(obj) : val
    //   Dep.target：全局属性，用于指向某一个watcher，用完即丢
      if (Dep.target) {
        /*
        进行依赖收集
        dep.depend()内部实现addDep，往dep中添加watcher实例 (具体参考Dep.prototype.depend的代码)
        depend的时候会根据id判断watcher有没有添加过，避免重复添加依赖
        */
        dep.depend()
        if (childOb) {
          /*子对象进行依赖收集，其实就是将同一个watcher观察者实例放进了两个depend中，一个是正在本身闭包中的depend，另一个是子元素的depend*/
          childOb.dep.depend()
        }
        if (Array.isArray(value)) {
          /*是数组则需要对每一个成员都进行依赖收集，如果数组的成员还是数组，则递归。*/
          dependArray(value)
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      /*通过getter方法获取当前值，与新值进行比较，一致则不需要执行下面的操作*/
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        /*如果原本对象拥有setter方法则执行setter*/
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      /*新的值需要重新进行observe，保证数据响应式*/
      childOb = observe(newVal)
      /*dep对象通知所有的观察者*/
      dep.notify()
    }
  })
}
```

defineReactive()方法主要通过Object.defineProperty()做了以下几件事:
- 在闭包里定义一个Dep实例；
- getter用来收集依赖，Dep.target是一个全局的属性，指向的那个watcher收集到dep里来（如果之前添加过就不会重复添加）；
- setter是在更新value的时候通知所有getter时候通知所有收集的依赖进行更新（dep.notify）。这边会做一个判断，如果newVal和oldVal一样，就不会有操作。

## Dep

在上面的defineReactive中提到了Dep，于是接下来看一下Dep的源码, dep主要是用来在数据更新的时候通知watchers进行更新：

```javascript
/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    // subs: Array<Watcher>
    this.subs = []
  }

  /*添加一个观察者对象*/
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  /*移除一个观察者对象*/
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  /*依赖收集，当存在Dep.target的时候添加观察者对象*/
//   在defineReactive的getter中会用到dep.depend()
  depend () {
    if (Dep.target) {
        // Dep.target指向的是一个watcher
      Dep.target.addDep(this)
    }
  }

  /*通知所有订阅者*/
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
        // 调用每一个watcher的update
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null
/*依赖收集完需要将Dep.target设为null，防止后面重复添加依赖。*/
```

- Dep是一个发布者，可以订阅多个观察者，依赖收集之后Dep中会有一个subs存放一个或多个观察者，在数据变更的时候通知所有的watcher。
- 再复习一下，Dep和Observer的关系就是Observer监听整个data，遍历data的每个属性给每个属性绑定defineReactive方法劫持getter和setter, 在getter的时候往Dep类里塞依赖（dep.depend），在setter的时候通知所有watcher进行update(dep.notify)

## Watcher

watcher接受到通知之后，会通过回调函数进行更新。<br>
接下来我们要仔细看一下watcher的源码。由之前的Dep代码可知的是，watcher需要实现以下两个作用：
- dep.depend()的时候往dep里添加自己；
- dep.notify()的时候调用watcher.update()方法，对视图进行更新；
同时要注意的是，watcher有三种：render watcher/ computed watcher/ user watcher(就是vue方法中的那个watch)

```javascript
export default class Watcher {
  vm: Component;
  expression: string; // 每一个DOM attr对应的string
  cb: Function; // update的时候的回调函数
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm
    /*_watchers存放订阅者实例*/
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    /*把表达式expOrFn解析成getter*/
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
   /*获得getter的值并且重新进行依赖收集*/
  get () {
    /*将自身watcher观察者实例设置给Dep.target，用以依赖收集。*/
    pushTarget(this)
    let value
    const vm = this.vm

    /*
      执行了getter操作，看似执行了渲染操作，其实是执行了依赖收集。
      在将Dep.target设置为自身观察者实例以后，执行getter操作。
      譬如说现在的的data中可能有a、b、c三个数据，getter渲染需要依赖a跟c，
      那么在执行getter的时候就会触发a跟c两个数据的getter函数，
      在getter函数中即可判断Dep.target是否存在然后完成依赖收集，
      将该观察者对象放入闭包中的Dep的subs中去。
    */
    if (this.user) {
        // this.user: 判断是不是vue中那个watch方法绑定的watcher
      try {
        value = this.getter.call(vm, vm)
      } catch (e) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      }
    } else {
      value = this.getter.call(vm, vm)
    }
    // "touch" every property so they are all tracked as
    // dependencies for deep watching
    /*如果存在deep，则触发每个深层对象的依赖，追踪其变化*/
    if (this.deep) {
      /*递归每一个对象或者数组，触发它们的getter，使得对象或数组的每一个成员都被依赖收集，形成一个“深（deep）”依赖关系*/
      traverse(value)
    }

    /*将观察者实例从target栈中取出并设置给Dep.target*/
    popTarget()
    this.cleanupDeps()
    return value
  }

  /**
   * Add a dependency to this directive.
   */
   /*添加一个依赖关系到Deps集合中*/
 //  在dep.depend()中调用的是Dep.target.addDep()
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
        // newDepIds和newDeps记录watcher实例所用到的dep，比如某个computed watcher其实用到了data里的a/b/c三个属性，那就需要记录3个dep
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        //  作用是往dep的subs里添加自己（Watcher实例）
        //  但是会先判断一下id，如果subs里有相同的id就不会重复添加
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
   /*清理依赖收集*/
  cleanupDeps () {
    /*移除所有观察者对象*/
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
//   dep.notify的时候会逐个调用watcher的update方法
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

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
   /*
      调度者工作接口，将被调度者回调。
    */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        /*
            即便值相同，拥有Deep属性的观察者以及在对象／数组上的观察者应该被触发更新，因为它们的值可能发生改变。
        */
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        /*设置新的值*/
        this.value = value

        /*触发回调渲染视图*/
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
   /*获取观察者的值*/
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
   /*收集该watcher的所有deps依赖*/
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
   /*将自身从所有依赖收集订阅列表删除*/
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      /*从vm实例的观察者列表中将自身移除，由于该操作比较耗费资源，所以如果vm实例正在被销毁则跳过该步骤。*/
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
```
要注意的是，watcher中有个sync属性，绝大多数情况下，watcher并不是同步更新的，而是采用异步更新的方式，也就是调用`queueWatcher(this)`推送到观察者队列当中，待nextTick的时候进行调用。详细原因可以查看[3.Vue中的异步更新策略](./3.Vue中的异步更新策略.MarkDown)