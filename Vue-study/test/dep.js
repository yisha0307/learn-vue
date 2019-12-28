import { parsePath } from "../vue-src/core/util";
import { pushTarget, popTarget } from "../vue-src/core/observer/dep";

// Dep类
// 每一个data里的属性都有dep类
// 由observer遍历data加上的，get的时候加依赖（Dep.addSub()), set的时候通知watcher进行更新(Dep.notify())
export default class Dep {
    static target: ?Watcher;
    id: Number;
    // subs: 收集watcher
    subs: Array<Watcher>;
    constructor () {
        this.id = id++
        this.subs = []
    }
    // 添加一个观察者对象
    // observer绑定dep的时候通过defineReactive给属性的get加上的
    addSub (sub: Watcher) {
        this.subs.push(sub)
    }
    // 移除一个观察者对象
    removeSub (sub: Watcher) {
        remove(this.subs, sub)
    }
    // 依赖收集，当存在dep.target的时候添加观察者对象
    depend () {
        if (Dep.target) {
            Dep.target.addDep(this)
        }
    }
    // 通知所有订阅者
    notify () {
        const subs = this.subs.slice()
        for (let i =0;i<subs.length;i++) {
            // 每一个watcher去进行更新
            subs[i].update()
        }
    }
}
// 依赖收集完需要将Dep.target设为null, 防止后面重复添加依赖
Dep.target = null

// defineReactive
export function defineReactive (
    obj: Object,
    key: string,
    val: any,
    customSetter?: Function
) {
    // 在闭包里定义一个dep对象
    const dep = new Dep()
    const property = Object.getOwnPropertyDescriptor(obj, key)
    if (property && property.configurable === false) {
        return
    }
    // 如果之前该对象已经预设了getter和setter就将其取出来
    const getter = property && property.get
    const setter = property && property.set
    let childOb = observe(val)
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter () {
            // 如果原本对象拥有getter方法则执行
            const value = getter ? getter.call(obj) : val
            if (Dep.target) {
                dep.depend()
                if (childOb) {
                    childOb.dep.depend()
                }
                if (Array.isArray(value)) {
                    dependArray(value)
                }
            }
            return value
        },
        set: function reactiveSetter (newVal) {
            // 通过getter方法获取当前值，与新值进行比较，一致则不需要执行以下操作
            const value = getter ? getter.call(obj) : val
            if (newVal === value || (newVal !== newVal && value !== value)) {
                return
            }
            if (process.env.NODE_ENV !== 'production' && customSetter) {
                customSetter()
            }
            if (setter) {
                // 如果有原本对象拥有setter方法则执行setter
                setter.call(obj, newVal)
            } else {
                val = newVal
            }
            childOb = observe(newVal)
            // dep对象通知所有的观察者
            dep.notify()
        }
    })
}

// Watcher类
// 把Dep和compile联系在一起
// 分成三种, render-watcher(渲染watcher) / computed-watcher(计算watcher) / normal-watcher(侦听器watcher)
// normal-watcher： 在watch里定义的
// computed-watcher： computed属性，lazy
// 执行顺序: computed-watcher -> normal-watcher -> render-watcher
export default class Watcher {
    vm: Component
    expression: string
    cb: Function
    id: number
    deep: boolean
    user: boolean
    lazy: boolean
    sync: boolean
    dirty: boolean
    active: boolean
    deps: boolean
    newDeps: boolean
    getter: Function
    value: any
    constructor (
        vm: Component,
        expOrFn: string | Function,
        cb: Function,
        options?: Object
    ) {
        this.vm = vm
        // _watchers存放订阅者实例
        vm._watchers.push(this)
        // options
        if (options) {
            this.deep = !!options.deep // 是否启用深度监听
            this.user = !!options.user // normal-watcher的user是true
            this.lazy = !!options.lazy // 惰性求值，compute-watcher
            this.sync = !!options.sync // 标记成同步计算， 三大类型暂无
        } else {
            this.deep = this.user = this.lazy = this.sync = false
        }
        this.cb = cb
        this.id = ++ uid
        this.active = true
        this.dirty = this.lazy
        this.deps = []
        this.newDeps = []
        this.depIds = new Set()
        this.newDepIds = new Set()
        this.expression = process.env.NODE_ENV !== 'production' ? expOrFn.toString() : ''
        // 解析expOrFn. 赋值给this.getter
        // render-watcher: expOrFn是updateComponent （typeof expOrFn === 'function')
        // compute-watcher: expOrFn是计算属性的方法 (typeof expOrFn === 'function')
        // normal-watcher: expOrFn是watch属性的名字，this.cb就是watch的handler属性 (typeof expOrFn === 'string')
        if (typeof expOrFn === 'function') {
            // 对于render watcher和compute watcher，expOrFn是一个函数，可以直接设成getter
            this.getter = expOrFn
        } else {
            // 对于normal watcher来说，expOrFunc是watch属性的名字，会使用parsePath解析路径，获取该属性的值
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
        this.value = this.lazy ? undefined : this.get()
    }
    get () {
        pushTarget(this)
        let value
        const vm = this.vm
        value = this.getter.call(vm, vm)
        if (this.deep) {
            traverse(value)
        }
        // 把观察者实例从taget栈中取出并设置给Dep.target
        popTarget()
        this.cleanupDeps()
        return value
    }
    addDep(dep: Dep) {
        const id = dep.id
        if (!this.newDeps.has(id)) {
            this.newDepIds.add(id)
            this.newDepIds.push(dep)
            if (!this.depIds.has(id)) {
                dep.addSub(this)
            }
        }
    }
}