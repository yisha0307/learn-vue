import { def } from "../vue-src/core/util"
import { arrayMethods } from "../vue-src/core/observer/array"

export function  observe(value: any, asRooteData: ?boolean): Observer | void {
    if (!isObject(value)) {
        return
    }
    let ob: Observer | void
    if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
        ob = value.__ob__
    } else if (
        // 为了确保value是单纯的对象，而不是函数或者Regexp等情况
        observerState.shouldConvert &&
        !isServerRendering() &&
        (Array.isArray(value) || isPlainObject(value)) &&
        Object.isExtensible(value) &&
        !value._isVue
    ) {
        // 给$options.data加上Observer
        ob = new Observer(value)
    }
    if (asRooteData && ob) {
        ob.vmCount++
    }
    return ob
}

// Observer类
// 为数据添加Dep依赖
// Dep是data每个对象包括子对象都有一个改对象，当所绑定的数据发生变化时，由dep通知watcher
// compile是html指令解析器，对每个元素节点进行扫描和解析，根据指令模板替换数据，以及绑定相应的更新数据
// watcher是连接Dep和compile的桥梁
export class Observer{
    value: any;
    dep: Dep;
    vmCount: number;
    constructor (value: any) {
        this.value = value
        this.dep = new Dep()
        this.vmCount = 0
        // 将Observer实例绑定到data的__ob__属性上面
        // def实际是一个Object.defineProperty的方法
        def(value, '__ob__', this)
        if (Array.isArray(value)) {
            const augment = hasProto ? protoAugment : copyAugment
            augment(value, arrayMethods, arrayKeys)
            // 如果是数组则需要遍历数组的每一个成员进行observe
            this.observeArray(value)
        } else {
            // 如果是对象直接用walk进行绑定
            this.walk(value)
        }
    }
    // walk through each property and convert them into getter/setter
    // only be called when value is Object
    walk (obj: Object) {
        const keys = Object.keys(obj)
        for (let i = 0; i <keys.length; i++) {
            // defineReactive绑定： 给每个属性加Dep对象
            // get的时候收集到dep类里
            // set的时候notify watcher去更新
            defineReactive(obj, value[i], obj[keys[i]])
        }
    }
    observeArray (items: Array<any>) {
        // Array<any>是typescript的写法，任意元素的数组
        // 数组需要遍历每一个成员进行observe
        for (let i = 0; i<items.length;i++){
            observe(items[i])
        }
    }
}