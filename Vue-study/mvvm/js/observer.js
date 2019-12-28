// 为mvvm.js提供observe
class Observer {
    constructor (value) {
        this.data = value
        this.dep = new Dep()
        this.walk(value)
    }
    walk (value) {
        var me = this
        // 劫持value每一个属性的get和set
        Object.keys(value).forEach(key => {
            me.convert(key, value[key])
        })
    }
    convert (key, value) {
        this.defineReactive(this.data, key, value)
    }
    defineReactive (data, key, value) {
        // 每一个属性一个dep
        var dep = new Dep()
        // 深层observe
        var childObj = observe(value)
        // get的时候收集依赖
        // set的时候notify watcher进行更新
        Object.defineProperty(data, key, {
            configurable: false,
            enumerable: true,
            get: () => {
                //一个全局的Dep.target，用完就null掉
              if (Dep.target) {
                  // depend用于新增订阅者watcher
                  dep.depend()
                  if (childObj) {
                    //   子对象进行依赖收集
                    // 其实就是将同一个watcher观察者实例放进了两个depend中，
                    // 一个是闭包里的depend, 还有一个是子元素的depend
                      childObj.dep.depend()
                  }
              }
              return value
            },
            set: (newVal) => {
                if (newVal === value) {
                    // 没有更新
                    return
                }
                value = newVal
                childObj = observe(newVal)
                // 通知订阅者
                dep.notify()
            }
        })
    }
}

function observe(data, vm) {
    if (!data || typeof data !== 'object') {
        return
    }
    return new Observer(data)
}

// 定义Dep
// 每一个data的属性都分配一个dep，每次get收集一个watcher,每次set通知所有的watcher进行更新
var uid = 0
class Dep {
    constructor () {
        this.id = uid++
        // 放watcher的array
        this.subs = []
    } 
    addSub (sub) {
        this.subs.push(sub)
    }
    removeSub (sub) {
        const index = this.subs.indexOf(sub)
        if (!!~index) {
            this.subs.splice(index, 1)
        }
    }
    depend () {
        // 只有新的依赖才要添加新的watcher
        Dep.target.addDep(this)
    }
    notify () {
        // set的时候通知所有的watcher (放在subs里面的那些)
        this.subs.forEach(sub => {
            // watcher里有一个update的方法
            sub.update()
        })
    }
}

Dep.target = null