## Vuex

首先，vuex是什么？

根据官方的解释，
> Vuex 是一个专为 Vue.js 应用程序开发的状态管理模式。它采用集中式存储管理应用的所有组件的状态，并以相应的规则保证状态以一种可预测的方式发生变化。

vue的整个状态管理主要包括以下几部分：
- state: 驱动应用的数据源；
- view: 以声明方式将 state 映射到视图；
- actions: 响应在 view 上的用户输入导致的状态变化。

看一下官网提供的单向数据流示意：
![](https://vuex.vuejs.org/flow.png)

但是，如果我们要在兄弟组件之间传值，或者要多个组件共享一个状态，这个单向数据流就会遭到破坏。在不使用vuex的时候，需要在父组件中定义好state，再用props传递给子组件，如果子组件要修改父组件的状态，就需要使用$emit事件。稍微进阶一点，可以使用busEvent, 就是new一个Vue实例出来，通过在target component上$on注册上一个事件，在source component上$emit触发这个事件，引起target component的状态改变。但是，一旦应用变得大型，这两种方式就变得非常脆弱。所以，vuex就诞生啦~

还是看一下官网的vuex示意图：
![](https://vuex.vuejs.org/vuex.png)

Vuex实现了一个单项数据流，在全局拥有一个state存放数据，所有修改state的操作必须通过mutation来进行执行，同时mutation只能同步修改state，如果要异步修改就需要调用action, 而action内部也是要使用mutation进行修改state的操作。最后，根据state的变化，渲染到视图上。

Vuex运行依赖Vue内部双向绑定机制，需要new Vue的实例来实现，因此，vuex只能和vue搭配使用。

更多vuex的详细介绍请参阅[Vuex官方教程](https://vuex.vuejs.org/zh/)。

## this.$store注入

首先，看一下store是如何install到vue上的，以下是vuex的install代码:
```javascript
/*暴露给外部的插件install方法，供Vue.use调用安装插件*/
export function install (_Vue) {
  if (Vue) {
    /*避免重复安装（Vue.use内部也会检测一次是否重复安装同一个插件）*/
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  /*保存Vue，同时用于检测是否重复安装*/
  Vue = _Vue
  applyMixin(Vue)
}
```
这段代码主要做了两件事：
- 检查有没有重复安装vuex
- 如果没有安装的话，就去调用applyMixin()

接下来看一下`applyMixin`的代码：
```javascript
export default function (Vue) {
  /*获取Vue版本，鉴别Vue1.0还是Vue2.0*/
  const version = Number(Vue.version.split('.')[0])

  if (version >= 2) {
    /*通过mixin将vuexInit混淆到Vue实例的beforeCreate钩子中*/
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    /*将vuexInit放入_init中调用*/
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   */
   /*Vuex的init钩子，会存入每一个Vue实例等钩子列表*/
  function vuexInit () {
    const options = this.$options
    // store injection
    if (options.store) {
      /*存在store其实代表的就是Root节点，直接执行store（function时）或者使用store（非function）*/
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
        // 从父组件里获取this.$store
      this.$store = options.parent.$store
    }
  }
}
```
上面的代码解释一下，就是先去检查vue的版本，如果是2.0就在beforeCreate的时候调用VueInit这个方法，如果是1.0就放入Vue的_init中；<br>
然后再看一下vuexInit这个方法，如果options存在store的话就证明是Root节点，直接执行store（因为我们注入store的时候，都会在new Vue的时候放进去，比如：
```javascript
new Vue({
  el: '#app',
  store
})
```
所以如果options里有store,就直接执行即可；如果没有，就从父组件中获取$store，这样就保证了所有组件都公用了全局的同一份store。

通过以上步骤，就完成了this.$store的注入，在工程的任何地方都可以应用，而且指向的都是同一个store。

## Store
回想一下，我们在定义Store的时候，通常是这样写的 (来自vuex官方教程举例)：
```javascript
const moduleA = {
  state: { ... },
  mutations: { ... },
  actions: { ... },
  getters: { ... }
}

const moduleB = {
  state: { ... },
  mutations: { ... },
  actions: { ... }
}

const store = new Vuex.Store({
  modules: {
    moduleA,
    moduleB
  }
})
```
因此，store其实是用来注册modules里的state/mutations/getters/actions。来看一下Store的代码(因为store构造类的源码很多，会一部分一部分讲)：
```javascript
/*Store构造类*/
export class Store {
  constructor (options = {}) {
    // 首先会检查一下浏览器环境内有没有vue
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    const {
      plugins = [],
     // 默认严格模式开启
      strict = false
    } = options

    /*从option中取出state，如果state是function则执行，最终得到一个对象*/
    let {
      state = {}
    } = options
    if (typeof state === 'function') {
      state = state()
    }

    // store internal state
    /* 用来判断严格模式下是否是用mutation修改state的 */
    this._committing = false
    // 以下是初始化actions/mutations/wrapperGetters/modules等
    /* 存放action */
    this._actions = Object.create(null)
    /* 存放mutation */
    this._mutations = Object.create(null)
    /* 存放getter */
    this._wrappedGetters = Object.create(null)
    /* module收集器 */
    this._modules = new ModuleCollection(options)
    /* 根据namespace存放module */
    this._modulesNamespaceMap = Object.create(null)
    /* 存放订阅者 */
    this._subscribers = []
    /* 用以实现Watch的Vue实例 */
    this._watcherVM = new Vue()

    // bind commit and dispatch to self
    /*将dispatch与commit调用的this绑定为store对象本身，否则在组件内部this.dispatch时的this会指向组件的vm*/
    const store = this
    const { dispatch, commit } = this
    /* 为dispatch与commit绑定this（Store实例本身） */
    // dispatch对应actions, commit对应mutations （dispatch里会有promise实现）
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    resetStoreVM(this, state)

    // apply plugins
    plugins.forEach(plugin => plugin(this))

    /* devtool插件 */
    if (Vue.config.devtools) {
      devtoolPlugin(this)
    }
  }
  ```
以上代码是Vue构造类的第一部分，可以看到除了初始化actions/mutations/modules...等等，还调用了installModule和resetStoreVM这两个方法。

看一下这两个方法分别是什么：
```javascript
function installModule (store, rootState, path, module, hot) {
  const isRoot = !path.length // path是[]表示是根节点
  /* 获取module的namespace */
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  /* 如果有namespace则在_modulesNamespaceMap中注册 */
  if (module.namespaced) {
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  if (!isRoot && !hot) {
    /* 获取父级的state */
    const parentState = getNestedState(rootState, path.slice(0, -1))
    /* module的name */
    const moduleName = path[path.length - 1]
    // 这边也用_withCommit是因为state只能在_committing === true的时候进行修改
    store._withCommit(() => {
    //   Vue.set内部会用defineReactive将module.state设置成响应式的
    // defineReactive的代码详见第一节
      Vue.set(parentState, moduleName, module.state)
    })
  }

  const local = module.context = makeLocalContext(store, namespace, path)

  /* 遍历注册mutation */
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  /* 遍历注册action */
  module.forEachAction((action, key) => {
    const namespacedType = namespace + key
    registerAction(store, namespacedType, action, local)
  })

  /* 遍历注册getter */
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  /* 递归安装mudule */
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}
```
installModule的作用主要是为module加上namespace名字空间（如果有）后，注册mutation、action以及getter，同时递归安装所有子module。
```javascript
/* 通过vm重设store，新建Vue对象使用Vue内部的响应式实现注册state以及computed */
function resetStoreVM (store, state, hot) {
  /* 存放之前的vm对象 */
  const oldVm = store._vm 

  // bind store public getters
  store.getters = {}
  const wrappedGetters = store._wrappedGetters
  const computed = {}

  /* 通过Object.defineProperty为每一个getter方法设置get方法，比如获取this.$store.getters.test的时候获取的是store._vm.test，也就是Vue对象的computed属性 */
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    computed[key] = () => fn(store)
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent
  /* Vue.config.silent暂时设置为true的目的是在new一个Vue实例的过程中不会报出一切警告 */
  Vue.config.silent = true
  /*  这里new了一个Vue对象，运用Vue内部的响应式实现注册state以及computed*/
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  Vue.config.silent = silent

  // enable strict mode for new vm
  /* 使能严格模式，保证修改store只能通过mutation */
  if (store.strict) {
    enableStrictMode(store)
  }

  if (oldVm) {
    /* 解除旧vm的state的引用，以及销毁旧的Vue对象 */
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy())
  }
}
```
在这段代码中, 其实是利用了vue.js可以对数据进行双向绑定的特点(具体参见[Vue的双向绑定原理（已完成）](./Vue的双向绑定原理.MarkDown))，new了一个vue的实例，并且绑定了state和computed, 这样就可以实现data和视图的同步更新。

继续看下Vuex.store里还有什么：
```javascript
  get state () {
    return this._vm._data.$$state
  }

  set state (v) {
    //   state不允许通过set进行修改，必须通过commit
    if (process.env.NODE_ENV !== 'production') {
      assert(false, `Use store.replaceState() to explicit replace store state.`)
    }
  }
  ```
  get没什么可说的，就是返回这个state里的值，但是set这边除了一个断言就没有了，意思是state里的数据并不能直接修改，必须用mutation。

## Store提供的Api
```javascript
  commit (_type, _payload, _options) {
    // unifyObjectStyle主要是统一参数的格式
    // 因为mutation 支持两种写法 (一种是列举参数，一种是把参数放在{}里，具体参见教程)
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    /* 取出type对应的mutation的方法 */
    const entry = this._mutations[type]
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    /* 执行mutation中的所有方法 */
    this._withCommit(() => {
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })
    /* 通知所有订阅者 */
    this._subscribers.forEach(sub => sub(mutation, this.state))

    if (
      process.env.NODE_ENV !== 'production' &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }
  _withCommit (fn) {
    // _committing是一个标志位，在strict模式下保证只能通过mutation来修改store的数据
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
```
mutation用的这个commit方法，要注意的就是这个_withCommit，在_withCommit里_committing是true, 因此，_committing是一个标志位，如果在strice mode(default true)下，一定要用commit方法才能修改。看一下这个断言：
```javascript
function enableStrictMode (store) {
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (process.env.NODE_ENV !== 'production') {
    //  function assert (condition, msg) {
    //   if (!condition) throw new Error(`[vuex] ${msg}`)
    // }
      assert(store._committing, `Do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}
```
调用的vue的wactch方法，在有变动的时候做一个检验，如果_committing不是true, 就扔出error。

继续看给actions调用的dispatch方法:
```javascript
  /* 调用action的dispatch方法 */
  dispatch (_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    /* actions中取出type对应的ation */
    const entry = this._actions[type]
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    /* 是数组则包装Promise形成一个新的Promise，只有一个则直接返回第0个 */
    return entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)
  }
```
`dispatch`这个方法比较简单，使用了Promise.all, 所以可以执行异步操作。
