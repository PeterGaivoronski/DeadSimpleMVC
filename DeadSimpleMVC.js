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
        Proto._id = undefined;
        Proto._deleted = false;
        Proto.init = function(){
            this._id = uuid.v4();
        }
        Proto.subscribe = function(event, func){
            $.subscribe(event+"."+this._id, func);
        }
        Proto.unsubscribe = function(event){
            $.unsubscribe(event+"."+this._id);
        }
        Proto.unsubscribeAll = function(){
            $.unsubscribe("."+this._id);
        }
        Proto.del = function(){
            this._deleted = true;
            this.unsubscribeAll();
        }
    });
    DS.DSClass = DSClass;

   	var Model = Class(DSClass, function(Proto, Super){
        Proto.init = function(properties){
            Super.init.call(this);
            this.modify(properties);
            DS.ModelRegistry[this._id] = this;
        }
        Proto.publish = function(action){
            //console.log('publishing action: '+action)
            $.publish('/models/'+action, [this]);
        }
        Proto.modify = function(properties){
            for(var property in properties){
                if(this.validate(property, properties[property])){
                    //console.log("setting "+property+" to "+properties[property])
                    this[property] = properties[property];
                }
            }
            this.publish("modify");
        }
        Proto.del = function(){
            delete DS.ModelRegistry[this._id];
            Super.del.call(this);
            this.publish("delete");
            console.log("delete pub sent")
        }
        Proto.validate = function(property, value){
            return true;
        }
        Proto.serialize = function(general, parse){
            var so = {};
            for(var field in this){
                if(typeof this[field] !== "function"){
                    switch(field){
                        case '_id':
                        case '_deleted':
                            if(general !== true){
                                so[field] = this[field];
                            }
                            break;
                        default:
                            so[field] = this[field];
                            break;
                    }
                }
            }
            so = JSON.stringify(so)
            if(parse !== true) return so;
            else return JSON.parse(so);
        }
    });
    DS.Model = Model;
    DS.ModelRegistry = {}

    var Collection = Class(DSClass, function(Proto, Super){
        Proto.elements = undefined;
        Proto.registry = undefined;
        Proto.init = function(elements, registry){
            Super.init.call(this);
            this.registry = registry;
            this.elements = [];
            for (var i = 0; i < elements.length; i++) {
                this.addElement(elements[i]);
            }
            DS.CollectionRegistry[this._id] = this;
            this.subscribe("/models/delete", $.proxy(this.deleteFunc, this));
        }
        //pass in element itself, not uuid
        Proto.addElement = function(element){
            this.elements.push(element._id);
        }
        //pass in element itself, not uuid
        Proto.removeElement = function(element){
            var newList = [];
            for(var i = 0; i < this.elements.length; i++){
                if(this.registry[this.elements[i]] !== element) newList.push(this.elements[i]);
            }
            this.elements = newList;
        }
        //auto-remove any deleted models from collections
        Proto.deleteFunc = function(_, model){
            if(this.elements.indexOf(model._id) !== -1){
                this.removeElement(model)
            }
        }
        // Proto.removeDeleted = function(){
        //     var newList = [];
        //     for(var i = 0; i < this.elements.length; i++){
        //         if(this.elements[i]._deleted === false) newList.push(this.elements[i]);
        //     }
        //     this.elements = newList;
        // }
        Proto.del = function(){
            delete DS.CollectionRegistry[this._id];
            Super.del.call(this);
        }
    });
    DS.Collection = Collection;
    DS.CollectionRegistry = {}

    var ModelCollection = Class(DS.Collection, function(Proto, Super){
        Proto.init = function(elements){
            Super.init.call(this, elements, DS.ModelRegistry);
        }
        Proto.sortByParam = function(paramName, ascending, apply){
            //console.log('sorting by: '+paramName+' ascending: '+ascending+' apply: '+apply);
            var sorted = this.elements.mergeSort(function(a, b){
                var aRef = DS.ModelRegistry[a]
                var bRef = DS.ModelRegistry[b]
                if(aRef[paramName] > bRef[paramName]){
                    if (ascending === true) return 1;
                    else return -1;
                }
                if(aRef[paramName] < bRef[paramName]){
                    if (ascending === true) return -1;
                    else return 1;
                }
                return 0;
            });
            //console.log('sorted models: '+JSON.stringify(sorted))
            if(apply === true) this.elements = sorted;
            else return sorted;
        }
    })
    DS.ModelCollection = ModelCollection

    var Displayer = Class(DSClass, function(Proto, Super){
        Proto.DOM = undefined;
        Proto.actions = undefined;
        Proto.template = undefined;
        Proto.assignViewEvents = function(){
            for(var domHook in this.actions){
                var dom = this.DOM.find(domHook);
                var action = this.actions[domHook];
                var i = 0;
                for (var domEvent in action){
                    //action[domEvent] is an array to allow sending multiple view events per domEvent
                    dom.off(domEvent);
                    for (i = 0; i < action[domEvent].length; i++){
                        (function(dom, domEvent, self, action, i){
                            dom.on(domEvent, function(){
                                self.sendViewEvent(action[domEvent][i]);
                            });
                        })(dom, domEvent, this, action, i)
                    }
                }
            }
        }
        Proto.sendViewEvent = function(event){
            $.publish('/views/'+event, [this]);
        }
    });

    var View = Class(Displayer, function(Proto, Super){
        Proto.model = undefined;
    	Proto.init = function(model, DOM){
            Super.init.call(this);
            if(model !== null) this.model =  model._id;
            else this.model = null;
            this.subscribeModel("modify", $.proxy(this.modifyFunc, this));
            this.subscribeModel("delete", $.proxy(this.deleteFunc, this));
            this.DOM = DOM;
            this.render();
            DS.ViewRegistry[this._id] = this;
    	}
    	Proto.render = function(){
            if(typeof this.model === "undefined") return;
            var html = this.renderTemplate();
    		this.DOM.html(html);
            this.assignViewEvents();
    	}
        Proto.getModel = function(){
            return DS.ModelRegistry[this.model]
        }
        Proto.renderTemplate = function(){
            return this.template(this.genTemplateArguments());
        }
        Proto.genTemplateArguments = function(){
            return {model: DS.ModelRegistry[this.model]};
        }
        Proto.subscribeModel = function(action, func){
            this.subscribe('/models/'+action, func);
        }
        Proto.unsubscribeModel = function(action){
            this.unsubscribe('/models/'+action);
        }
        Proto.modifyFunc = function(_, model){
            if(this.model === model._id){
                this.render();
            }
        }
        Proto.deleteFunc = function(_, model){
            if(this.model === model._id){
                //console.log("delete function called ")
                //console.log(this)
                this.del()
                this.DOM.html("")
                $.publish("/views/delete", [this]);
            }
        }
        Proto.del = function(){
            this.model = undefined;
            delete DS.ViewRegistry[this._id];
            Super.del.call(this);
        }
    });
    DS.View = View;
    DS.ViewRegistry = {}

    //metaviews themselves don't listen for model changes, because they are not associated with any model in particular. instead, they create and delete views to be able to display collections in ordered ways.
    var MetaView = Class(Displayer, function(Proto, Super){
        Proto.models = undefined;
        Proto.modelViews = undefined;
        Proto.limitIndex = 0;
        Proto.limit = null;
        Proto.currentSortProperties = undefined;
        Proto.viewClass = undefined;
        Proto.init = function(models, DOM, limit){
            if(typeof limit !== "undefined") this.limit = limit;
            Super.init.call(this);
            this.models = models;
            this.modelViews = {};
            this.DOM = DOM;
            this.currentSortProperties = {};
            this.refresh();
            this.subscribe('/collections/update', $.proxy(this.genNewViews, this));
            this.subscribe('/views/delete', $.proxy(this.refresh, this));
            DS.MetaViewRegistry[this._id] = this;
        };
        Proto.clear = function(){
            var html = this.renderTemplate();
            this.DOM.html(html);
            this.assignViewEvents();
        };
        Proto.renderTemplate = function(){
            var html = "<div class = 'content'></div>";
            if (this.template !== undefined) html = this.template(this.genTemplateArguments());
            return html;
        }
        Proto.genTemplateArguments = function(){
            return {};
        }
        Proto.appendView = function(modelID){
            if(this.modelViews[modelID] === undefined) this.createModelView(modelID);
            else{
                var model = DS.ModelRegistry[modelID]
                var view = DS.ViewRegistry[this.modelViews[modelID]];
                view.DOM = this.genViewDom(model);
                view.render();
            }
        }
        Proto.createModelView = function(modelID){
            //console.log("creating model view with id: "+modelID)
            //console.log(JSON.stringify( this.viewClass(DS.ModelRegistry[modelID], this.genViewDom()) ))
            var model = DS.ModelRegistry[modelID]
            this.modelViews[modelID] = this.viewClass(model, this.genViewDom(model))._id;
            //console.log(this.modelViews)
        }
        Proto.genViewDom = function(model){
            return $("<div></div>").appendTo(this.DOM.find('.content'));
        }
        Proto.refresh = function(){
            //console.log("removing deleted modelviews")
            this.removeDeleted();
            //console.log("sorting models..")
            var models = this.sortModelsByProperties();
            //console.log(models)
            this.clear();
            var endLimit = models.length;
            if(this.limit !== null){
                //if the collection has been resized, make sure we are not displaying nothing
                if(this.limitIndex > models.length-1){
                    return this.lastPage();
                }
                endLimit = this.limit+this.limitIndex;
            }
            if(endLimit > models.length) endLimit = models.length;
            for(var i = this.limitIndex; i < endLimit; i++){
                this.appendView(models[i]);
            }
        }
        Proto.genNewViews = function(_, collection){
            if(collection === this.models){
                this.refresh();
            }
        }
        //goes to given page
        Proto.switchPage = function(page){
            if(page*this.limit > this.models.elements.length-1 || page < 0) return false;
            this.limitIndex = page*this.limit;
            this.refresh();
        }
        //goes forward 1 page
        Proto.nextPage = function(){
            if(this.limitIndex + this.limit > this.models.elements.length-1) return false;
            this.limitIndex += this.limit;
            this.refresh();
        }
        //goes back 1 page
        Proto.previousPage = function(){
            if(this.limitIndex - this.limit < 0) return false;
            this.limitIndex -= this.limit;
            this.refresh();
        }
        //goes to first page
        Proto.firstPage = function(){
            this.switchPage(0);
        }
        //goes to last page
        Proto.lastPage = function(){
            return this.switchPage(Math.floor( (this.models.elements.length-1) / this.limit ))
        }
        //returns current page number
        Proto.getPage = function(){
            return Math.floor(this.limitIndex/this.limit);
        }
        Proto.removeDeleted = function(){
            for(var modelID in this.modelViews){
                var viewID = this.modelViews[modelID]
                var modelRef = DS.ModelRegistry[modelID]
                //if view is undefined, the view's model reference is undefined, or view is set to deleted
                if (typeof DS.ViewRegistry[viewID] === "undefined" || typeof modelRef === "undefined" || DS.ViewRegistry[viewID]._deleted === true){
                    //console.log(modelID+" is deleted")
                    delete this.modelViews[modelID]
                    this.models.removeElement(modelRef)
                }
            }
        }
        //override this function to make your own sort property processors to be able to sort items any way you want.
        Proto.sortModelsByProperties = function(){
            if(this.models instanceof ModelCollection === true && this.currentSortProperties["paramName"] !== undefined){
                var paramName = this.currentSortProperties["paramName"];
                var ascending = true;
                if (this.currentSortProperties["ascending"] !== undefined) ascending = this.currentSortProperties["ascending"];
                return this.models.sortByParam(paramName, ascending, false);
            }
            else return this.models.elements;
        }
        Proto.del = function(){
            delete DS.MetaViewRegistry[this._id]
            Super.del.call(this)
        }
    });
    DS.MetaView = MetaView;
    DS.MetaViewRegistry = {}

    var ViewGroup = Class(Collection, function(Proto, Super){
        Proto.init = function(elements){
            Super.init.call(this, elements, DS.ViewRegistry)
        }
        Proto.hideAll = function(){
            for (var i = 0; i < this.elements.length; i++) {
                this.getObj(this.elements[i]).DOM.hide();
            };
        }
        Proto.showAll = function(){
            for (var i = 0; i < this.elements.length; i++) {
                this.getObj(this.elements[i]).DOM.show();
            };
        }
        Proto.getObj = function(objUUID){
            var obj = DS.ViewRegistry[objUUID];
            if(typeof obj === "undefined"){
                obj = DS.MetaViewRegistry[objUUID];
                if(typeof obj === "undefined"){
                    return false;
                }
            }
            return obj;
        }
    })
    DS.ViewGroup = ViewGroup;

    var Controller = Class(DSClass, function(Proto, Super){
    	Proto.events = undefined;
    	Proto.init = function(){
            Super.init.call(this);
            for(var event in this.events){
                //console.log("subscribing "+this.events[event]+" to event "+event)
                this.subscribe('/views/'+event, this.events[event]);
            }
            DS.ControllerRegistry[this._id] = this
    	};
        Proto.del = function(){
            delete DS.ControllerRegistry[this._id]
            Super.del.call(this)
        }
    });
    DS.Controller = Controller;
    DS.ControllerRegistry = {}

	exports.DeadSimpleMVC = DS;
})(P, jQuery, uuid, window); 

})();