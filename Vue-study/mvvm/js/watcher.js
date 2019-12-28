// 实现一个watcher
// dep.depend的时候往dep里添加自己
// dep.notify的时候调用update()

class Watcher {
    constructor (vm, expOrFn, cb) {
        // watcher有三种，render / computed / watch
        this.vm = vm
        this.expOrFn = expOrFn
        this.cb = cb
        // 收集dep
        this.depIds = {}
        
        if (typeof expOrFn === 'function') {
            this.getter = expOrFn
        } else {
            this.getter = this.parseGetter(expOrFn.trim())
        }
        this.value = this.get()
    }
    update () {
        // data set属性的时候，通过observer触发dep.notify()
        // 从而通知所有的watcher(存在subs里面的那些)进行update
        this.run()
    }
    run () {
        // 进行update
        const value = this.get()
        const oldVal = this.value
        if (value !== oldVal) {
            // 一样的值就没必要更新了
            this.value = value
            // 进行vm渲染
            this.cb.call(this.vm, value, oldVal)
        }
    }
    addDep (dep) {
        // Dep.target === this，
        // 在每次get data属性value的时候dep.depend(), 调用addDep()
        // 就是去dep.subs里塞本身
        // 加入相应的dep的id已经在watcher的dep.id里，说明之前已经添加过了，不需要进行添加，只要改变值就可以了
        // 
        if (!this.depIds.hasOwnProperty(dep.id)) {
            // 往dep里添加自身
            dep.addSub(this)
            this.depIds[dep.id] = dep
        }
    }
    get () {
        // 全局的Dep指向this watcher
        Dep.target = this
        var value = this.getter.call(this.vm, this.vm)
        // 取到了value就把全局Dep设成null
        Dep.target = null
        return value
    }
    parseGetter (exp) {
        if (/[^\w.$]/.test(exp)) return
        var exps = exp.split('.')
        return function(obj) {
            for (var i = 0, len = exps.length; i<len; i++) {
                if (!obj) return
                obj = obj[exps[i]]
            }
            return obj
        }
    }
}