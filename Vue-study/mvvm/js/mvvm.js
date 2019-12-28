// 入口函数 -->
// 作为整个MVVM框架的入口
function MVVM(options) {
    // options: el, data, methods
    this.$options = options
    var data = this._data = this.$options.data,
        me = this
    Object.keys(data).forEach(key => {
        me._proxy(key)
    })
    // observe整个data
    observe(data, this)
    // compile对html进行正则匹配，--> 渲染
    this.$compile = new Compile(options.el || document.body, this)
}

MVVM.prototype = {
    _proxy: function(key) {
        var me = this
        Object.defineProperty(me, key, {
            configurable: false,
            enumerable: true,
            get: function proxyGetter() {
                return me._data[key]
            },
            set: function proxySetter (newVal) {
                me._data[key] = newVal
            }
        })
    }
}