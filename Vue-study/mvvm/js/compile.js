// compile: 对每个元素节点的指令进行扫描和解析，根据指令模板替换数据，以及绑定相应的更新函数
// 解析模板指令，将模板中的变量替换成数据
// 渲染视图
// 给每个指令添加订阅者，一旦数据有变动，就更新视图
class Compile {
    constructor(el, vm) {
        this.$vm = vm
        this.$el = this.isElementNode(el) ? el: document.querySelector(el)
        if (this.$el) {
            // 提高性能和效率，先将vue实例根节点的el转换成文档碎片fragment进行解析编译操作
            // 解析完成，再将fragment添加回el
            this.$fragment = this.node2Fragment(this.$el)
            this.init()
            this.$el.appendChild(this.$fragment)
        }
    }
    node2Fragment (el) {
        var fragment = document.createDocumentFragment(),
            child
        // 将原生节点拷贝到fragment
        while (child = el.firstChild) {
            fragment.appendChild(child)
        }
        return fragment
    }
    init () {
        this.compileElement(this.$fragment)
    }
    // 遍历所有节点和子节点，进行扫描解析编译，调用对应的指令渲染函数进行渲染
    // 并调用相应的指令更新函数进行绑定
    compileElement (el) {
        var childNodes = el.childNodes || []
        var me = this
        var nodesChild = [].slice.call(childNodes)
        nodesChild.forEach(function(node) {
            let text = node.textContent
            let reg = /\{\{(.*)\}\}/
            if (me.isElementNode(node)) {
                // 如果是element节点就compile
                me.compile(node)
            } else if (me.isTextNode(node) && reg.test(text)) {
                me.compileText(node, RegExp.$1.trim())
            }
            if (node.childNodes && node.childNodes.length) {
                // 有子节点就递归
                me.compileElement(node)
            }
        })
    }
    compile (node) {
        var nodeAttrs = node.attributes, me = this
        const arratrs = [].slice.call(nodeAttrs)
        arratrs.forEach(function (attr) {
            var attrName = attr.name
            if (me.isDirective(attrName)) {
                let exp = attr.value
                let dir = attrName.substring(2)
                // 事件指令
                if(me.isEventDirective(dir)) {
                    compileUtil.eventHandler(node, me.$vm, exp, dir)
                } else {
                    // 普通指令
                    compileUtil[dir] && compileUtil[dir](node, me.$vm, exp)
                }
                node.removeAttribute(attrName)
            }
        })
    }
    compileText(node, exp) {
        compileUtil.text(node, this.$vm, exp)
    }
    isDirective (attr) {
        return attr.indexOf('v-') == 0
    }
    isEventDirective (dir) {
        return dir.indexOf('on') === 0
    }
    isElementNode (node) {
        return node.nodeType === 1
    }
    isTextNode (node) {
        return node.nodeType === 3
    }
}

// v-指令集合(dir = substring(attrName), 去掉了前面的'v-'))
const compileUtil = {
    // 要用this, 慎用箭头函数
    // exp: attr.value
    text: function (node, vm, exp) {
        this.bind(node, vm, exp, 'text')
    },
    html: function (node, vm, exp) {
        this.bind(node, vm, exp, 'html')
    },
    model: function (node, vm, exp) {
        this.bind(node, vm, exp, 'model')
        // model要做双向绑定
        var me = this
        var val = this._getVMVal(vm, exp)
        node.addEventListener('input', function(e) {
            var newValue = e.target.value
            if (val === newValue) {
                return
            }
            me._setVMVal(vm, exp, newValue)
            val = newValue
        })
    },
    class: function (node, vm, exp) {
        this.bind(node, vm, exp, 'class')
    },
    bind: function (node, vm, exp, dir) {
        var updateFn = updater[dir + 'Updater']
        updateFn && updateFn(node, this._getVMVal(vm, exp))
        new Watcher(vm, exp, function(value, oldValue) {
            updateFn && updateFn(node, value, oldValue)
        })
    },
    // 事件处理
    eventHandler: function(node, vm, exp, dir) {
        // dir: on:click之类的
        var eventType = dir.split(':')[1],
            fn = vm.$options.methods && vm.$options.methods[exp]
        if (eventType && fn) {
            node.addEventListener(eventType, fn.bind(vm), false)
        }
    },
    _getVMVal: (vm, exp) => {
        // 取值
        var val = vm
        exp.split('.').forEach(k => {
            val = val[k]
        })
        return val
    },
    _setVMVal: (vm, exp, newValue) => {
        var val = vm
        exp = exp.split('.')
        exp.forEach((k, i) => {
            if (i < exp.length - 1) {
                val = val[k]
            } else {
                val[k] = newValue
            }
        })
    }
}

var updater = {
    textUpdater: (node, value) => {
        node.textContent = typeof value === 'undefined' ? '' : value
    },
    htmlUpdater: (node, value) => {
        node.innerHTML = typeof value === 'undefined' ? '' : value
    },
    classUpdater: (node, value, oldValue) => {
        var className = node.className
        className = className.replace(oldValue, '').replace(/\s$/, '')
        var space = className && String(value) ? ' ': ''
        node.className = className + space + value
    },
    modelUpdater: function(node, value, oldValue) {
        node.value = typeof value === 'undefined' ? '':value
    }
}