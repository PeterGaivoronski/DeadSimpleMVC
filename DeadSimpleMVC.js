/*
Copyright (C) 2013 by Peter Gaivoronski
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function(){
var prereqs = true;
var library, libraryLink;
if(typeof P === "undefined"){
    prereqs = false;
    library = "P.js for object classes";
    libraryLink = "https://github.com/jayferd/pjs";
}
else if(typeof jQuery === "undefined"){
    prereqs = false;
    library = "jQuery for DOM manipulation";
    libraryLink = "http://jquery.com/";
}
else if(typeof uuid === "undefined"){
    prereqs = false;
    library = "node-uuid for unique model IDs";
    libraryLink = "https://github.com/broofa/node-uuid";
}
else if(typeof jQuery.publish === "undefined"){
    prereqs = false;
    library = "jQuery pubsub for publish/subscribe functionality";
    libraryLink = "https://github.com/cowboy/jquery-tiny-pubsub";
}
else if(typeof jQuery.mergeSort === "undefined"){
    prereqs = false;
    library = "Merge-sort to sort things in place in all browsers";
    libraryLink = "https://github.com/justinforce/merge-sort";
}
if(prereqs === false){
    console.error("ERROR: Dead Simple MVC needs "+library+". Download at: "+libraryLink);
    return;
}

(function(Class, $, uuid, exports){

   	var DS = {};

    var DSClass = Class(function(Proto){
        Proto.init = function(){
        }
    });

   	var Model = Class(DSClass, function(Proto, Super){
        Proto._id = undefined;
        Proto._deleted = false;
        Proto.init = function(properties){
            Super.init.call(this);
            this._id = uuid.v4();
            this.modify(properties);
        }
        Proto.publish = function(action){
            console.log('publishing action: '+action)
            $.publish('/models/'+action, [this]);
        }
        Proto.modify = function(properties){
            for(var property in properties){
                if(this.validate(property, properties[property])){
                    console.log("setting "+property+" to "+properties[property])
                    this[property] = properties[property];
                }
            }
            this.publish("modify");
        }
        Proto.del = function(){
            this._deleted = true;
            this.publish("delete");
        }
        Proto.validate = function(property, value){
            return true;
        }
        Proto.serialize = function(){
            var so = {};
            for(var field in this){
                if(typeof this[field] !== "function"){
                    so[field] = this[field];
                }
            }
            return JSON.stringify(so);
        }
    });
    DS.Model = Model;

    var Collection = Class(DSClass, function(Proto, Super){
        Proto.models = undefined;
        Proto.init = function(models){
            Super.init.call(this);
            this.models = models;
        }
        Proto.addElement = function(element){
            this.models.push(element);
        }
        Proto.removeElement = function(element){
            var newList = [];
            for(var i = 0; i < this.models.length; i++){
                if(this.models[i] !== element) newList.push(this.models[i]);
            }
            this.models = newList;
        }
        Proto.removeDeleted = function(){
            var newList = [];
            for(var i = 0; i < this.models.length; i++){
                if(this.models[i]._deleted === false) newList.push(this.models[i]);
            }
            this.models = newList;
        }
        Proto.sortByParam = function(paramName, ascending, apply){
            var sorted = this.models.mergeSort(function(a, b){
                if(a[paramName] > b[paramName]){
                    if (ascending === true) return 1;
                    else return -1;
                }
                if(a[paramName] < b[paramName]){
                    if (ascending === true) return -1;
                    else return 1;
                }
                return 0;
            });
            if(apply === true) this.models = sorted;
            else return sorted;
        }
    });
    DS.Collection = Collection;

    var Displayer = Class(DSClass, function(Proto, Super){
        Proto.DOM = undefined;
        Proto.actions = undefined;
        Proto.template = undefined;
        Proto.assignViewEvents = function(){
            for(var domHook in this.actions){
                (function(dom, action, self){
                    var domEvent = action[0];
                    var viewEvent = action[1];
                    dom.off(domEvent);
                    dom.on(domEvent, function(){
                        self.sendViewEvent(viewEvent);
                    });
                })(this.DOM.find(domHook), this.actions[domHook], this)
            }
        }
        Proto.sendViewEvent = function(event){
            $.publish('/views/'+event, [this]);
        }
    });

    var View = Class(Displayer, function(Proto, Super){
        Proto._id = undefined;
        Proto.model = undefined;
    	Proto.init = function(model, DOM){
            Super.init.call(this);
            this._id = uuid.v4();
            this.model =  model;
            this.subscribeModel("modify."+this._id, $.proxy(this.modifyFunc, this));
            this.subscribeModel("delete."+this._id, $.proxy(this.deleteFunc, this));
            this.DOM = DOM;
            this.render();
    	}
    	Proto.render = function(){
            if(typeof this.model === "undefined") return;
            var html = this.renderTemplate();
    		this.DOM.html(html);
            this.assignViewEvents();
    	}
        Proto.renderTemplate = function(){
            return this.template({model: this.model});
        }
        Proto.subscribeModel = function(action, func){
            $.subscribe('/models/'+action, func);
        }
        Proto.unsubscribeModel = function(action){
            $.unsubscribe('/models/'+action);
        }
        Proto.modifyFunc = function(_, model){
            console.log("caught modify event")
            if(this.model === model){
                this.render();
            }
        }
        Proto.deleteFunc = function(_, model){
            if(this.model === model){
                console.log("publishing view delete. view is: "+this.DOM.html()+" this view's model is: "+this.model.name)
                $.publish("/views/delete", [this]);
                this.DOM.html("");
                this.DOM = undefined;
                this.model = undefined;
                $.unsubscribe("."+this._id);
            }
        }
    });
    DS.View = View;

    //metaviews themselves don't listen for model changes, because they are not associated with any model in particular. instead, they create and delete views to be able to display collections in ordered ways.
    var MetaView = Class(Displayer, function(Proto, Super){
        Proto.models = undefined;
        Proto.modelViews = undefined;
        Proto.currentSortProperties = undefined;
        Proto.viewClass = undefined;
        Proto.init = function(models, viewClass, DOM){
            Super.init.call(this);
            this.models = models;
            this.modelViews = {};
            this.DOM = DOM;
            this.viewClass = viewClass;
            for(var i = 0; i < models.length; i++){
                this.createModelView(model);
            }
            console.log("model views created: "+this.modelViews)
            this.currentSortProperties = {};
            this.refresh();
            $.subscribe('/views/delete', $.proxy(this.refresh, this));
        };
        Proto.clear = function(){
            var html = this.renderTemplate();
            this.DOM.html(html);
            this.assignViewEvents();
        };
        Proto.renderTemplate = function(){
            var html = "<div class = 'content'></div>";
            if (this.template !== undefined) html = this.template({});
            return html;
        }
        Proto.appendView = function(model){
            if(this.modelViews[model._id] === undefined) this.createModelView(model);
            else{
                var view = this.modelViews[model._id];
                view.DOM = this.genViewDom();
                view.render();
            }
        }
        Proto.createModelView = function(model){
            this.modelViews[model._id] = this.viewClass(model, this.genViewDom());
        }
        Proto.genViewDom = function(){
            return $("<div></div>").appendTo(this.DOM.find('.content'));
        }
        Proto.refresh = function(){
            this.models.removeDeleted();
            var models = this.sortModelsByProperties();
            this.clear();
            for(var i = 0; i < models.length; i++){
                this.appendView(models[i]);
            }
        }
        //override this function to make your own sort property processors to be able to sort items any way you want.
        Proto.sortModelsByProperties = function(){
            if(this.currentSortProperties["paramName"] !== undefined){
                var paramName = this.currentSortProperties["paramName"];
                var ascending = true;
                if (this.currentSortProperties["ascending"] !== undefined) ascending = this.currentSortProperties["ascending"];
                return this.models.sortByParam(paramName, ascending, false);
            }
            else return this.models.models;
        }
    });
    DS.MetaView = MetaView;

    var Controller = Class(DSClass, function(Proto, Super){
    	Proto.events = undefined;
    	Proto.init = function(){
            Super.init.call(this);
            for(var event in this.events){
                $.subscribe('/views/'+event, this.events[event]);
            }
    	};
    });
    DS.Controller = Controller;

	exports.DeadSimpleMVC = DS;
})(P, jQuery, uuid, window); 

})();