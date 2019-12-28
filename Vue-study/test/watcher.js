import { parsePath, handleError } from "../vue-src/core/util";
import { pushTarget, popTarget } from "../vue-src/core/observer/dep";

// watcher类
// 观察者对象
export default class Watcher {
    vm: Component;
    expression: String;
    cb: Function;
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
        expOrFunc: string | Function,
        cb: Function,
        options?: Object
    ) {
        this.vm = vm
        // _watchers存放订阅者实例
        vm._watchers.push(this)
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
        this.expression = process.env.NODE_ENV !== 'production' ? expOrFunc.toString() : ''
        //  parse expression for getter
        // 把表达式expOrFunc解析成getter
        if (typeof expOrFunc === 'function') {
            this.getter = expOrFunc
        } else {
            this.getter = parsePath(expOrFunc)
            if (!this.getter) {
                // 一个warning
                this.getter = function(){}
                process.env.NODE_ENV !== 'production' && warn('')
            }
        }
        this.value = this.lazy ? undefined : this.getter()
    }
    // 获得getter的值并且重新进行依赖收集
    get () {
        // 将自身watcher观察者实例设置给Dep.target的堆栈
        pushTarget(this)
        let value
        const vm = this.vm
        if (this.user) {
            try {
                value = this.getter.call(vm, vm)
            } catch (e) {
                handleError(e, vm, `getter for watcher "${this.expression}"`)
            }
        } else {
            value = this.getter.call(vm, vm)
        }
        // 如果存在deep, 则触发每个深层对象的依赖，追踪其变化
        if (this.deep) {
            // 递归每一个对象或者数组，触发他们的getter
            traverse(value)
        }
        popTarget()
        this.cleanupDeps()
        return value
    }
}