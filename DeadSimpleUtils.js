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
else if(typeof DeadSimpleMVC === "undefined"){
    prereqs = false;
    library = "DeadSimpleMVC for core code";
    libraryLink = "https://github.com/PeterGaivoronski/DeadSimpleMVC";
}
else if(typeof Handlebars === "undefined"){
    prereqs = false;
    library = "Handlebars for templating";
    libraryLink = "https://github.com/wycats/handlebars.js/";
}
if(prereqs === false){
    console.error("ERROR: Dead Simple Utils needs "+library+". Download at: "+libraryLink);
    return;
}

(function($, Class, H, DS){

	var exports = {}
	
	//ANIMATIONS
	var anim = {};

	var animations = {};
    var i;
    var now;
    var animator = setInterval(function(){
        now = (new Date).getTime();
        for (i in animations){
            //console.log("animator: "+(animations[i][0] + animations[i][1]))
            if(animations[i][0] + animations[i][1] < now){
                //console.log("running animation")
                animations[i][0] = now;
                animations[i][2]();
            }
        }
        //console.log("animating..."+animations)
    }, 13);
    anim.animations = animations;

    exports.Anim = anim;

	//FORM
	var form = {}

    var formTemplate = H.compile("\
        <form class = 'mainForm'></form>\
        <div class = 'submit'>Submit</div>\
        ");
    form.formTemplate = formTemplate

    var columnTemplate = H.compile("\
        <span class = 'column'>{{displayName}}</span>\
        <span class = 'column inputColumn'>{{{input}}}</span>\
        ")
    form.columnTemplate = columnTemplate

	var ValidationRegex = {
		name: /^[A-Za-z0-9 ]{2,20}$/,
		email: /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i,
        telephone: /^\(?[0-9]{3}\)?\-?[0-9]{3}\-?[0-9]{4}$/,
        month: /^([1-9]|[1][0-2])$/,
        year2Digit: /^[0-9]{2}$/,
        year4Digit: /^[0-9]{4}$/,
        state: /^[A-Za-z]{2}$/,
        zip: /^[0-9]{5}$/,
        creditCardNumber: /^[0-9]{4}\-?[0-9]{4}\-?[0-9]{4}\-?[0-9]{4}$/,
        creditCardCV: /^[0-9]{3}$/
	}
	form.ValidationRegex = ValidationRegex

    var inputMessageTemplate = H.compile("\
        <span class = 'inputMessage {{valid}}'>{{message}}</span>\
        ")
    form.inputMessageTemplate = inputMessageTemplate

    var inputTextTemplate = H.compile("\
        <input type = 'text' class = 'input {{model.valid}}' name = '{{model.name}}' value = '{{model.value}}' /><br>\
        {{{inputMessage}}}\
        ")
    form.inputTextTemplate = inputTextTemplate

    var inputPasswordTemplate = H.compile("\
        <input type = 'password' class = 'input {{model.valid}}' name = '{{model.name}}' value = '{{model.value}}' /><br>\
        {{{inputMessage}}}\
        ")
    form.inputPasswordTemplate = inputPasswordTemplate

    var inputCheckboxTemplate = H.compile("\
        <input type = 'checkbox' class = 'input {{model.valid}}' name = '{{model.name}}' value = '{{model.value}}' {{checked}} /><br>\
        {{{inputMessage}}}\
        ")
    form.inputCheckboxTemplate = inputCheckboxTemplate

    var inputHiddenTemplate = H.compile("\
        <input type = 'hidden' class = 'input {{model.valid}}' name = '{{model.name}}' value = '{{model.value}}' />\
        ")
    form.inputHiddenTemplate = inputHiddenTemplate

    var inputSelectTemplate = H.compile("\
        <select class = 'input {{model.valid}}' name = '{{model.name}}' value = '{{model.value}}'>{{{options}}}</select>\
        {{{inputMessage}}}\
        ")
    form.inputSelectTemplate = inputSelectTemplate

    var selectOptionTemplate = H.compile("\
        <option value = '{{optionValue}}' {{selected}}>{{optionName}}</option>\
        ")
    form.selectOptionTemplate = selectOptionTemplate

    var InputField = Class(DS.Model, function(Proto, Super){
        Proto.name = "";
        Proto.displayName = "";
        Proto.value = "";
        Proto.inputType = "";
        Proto.required = false;
        Proto.requiredValue = undefined;
        Proto.valid = "";
        Proto.invalidMessage = "Incorrectly Formatted Input";
        Proto.blankMessage = "Required";
        Proto.validType = "";
        Proto.inputChoices = undefined;
        //need this to avoid triggering validation before field has been touched
        Proto.initialDisplay = true;
        Proto.displayGroup = false;
        Proto.noTable = false;
        Proto.customTemplate = undefined;

        Proto.validateValue = function(){
            if(this.initialDisplay === true){
                this.valid = "valid";
                return true;
            }

            if(typeof this.requiredValue !== "undefined"){
                if(this.value !== this.requiredValue){
                    this.valid = "invalid";
                    return false;
                }
            }

            if(this.required === true && this.value === ""){
                this.valid = "blank";
                return false;
            }
            var regex = ValidationRegex[this.validType]
            if(typeof regex !== "undefined"){
                if(regex.test(this.value) === false){
                    this.valid = "invalid";
                    return false;
                }
            }
            this.valid = "valid";
            return true;
        }

        Proto.modify = function(properties){
        	//force strings
        	if(typeof properties.value === "number") properties.value = properties.value.toString()
        	Super.modify.call(this, properties)
        }

    })
	form.InputField = InputField

	var DisplayGroup = Class(DS.Model, function(Proto, Super){
		Proto.name = "";
		Proto.displayName = "";
		Proto.template = undefined;
	})
	form.DisplayGroup = DisplayGroup

    var InputFieldView = Class(DS.View, function(Proto, Super){
        Proto.template = undefined;
        Proto.templateMap = {
            'text': inputTextTemplate,
            'select': inputSelectTemplate,
            'password': inputPasswordTemplate,
            'checkbox': inputCheckboxTemplate,
            'hidden': inputHiddenTemplate
        }
        Proto.init = function(model, DOM){
            if(typeof model.customTemplate !== "undefined"){
                this.template = model.customTemplate;
            }else{
                for (var template in this.templateMap){
                    if(model.inputType === template){
                        this.template = this.templateMap[template];
                        break;
                    }
                }
            }
            Super.init.call(this, model, DOM)
        }
        Proto.genTemplateArguments = function(){
            var model = this.getModel()
            model.validateValue();
            var message = model.invalidMessage;
            if(model.valid === "blank") message = model.blankMessage;
            var inputMessage = inputMessageTemplate({message: message, valid: model.valid})
            return {inputMessage: inputMessage, model: model};
        }
        Proto.renderTemplate = function(){
            var args = this.genTemplateArguments();
            //special rendering rules
            switch(args.model.inputType){
                case "select":
                    var choiceOptions = "";
                    var optionValue;
                    var selected;
                    for(var choice in args.model.inputChoices){
                    	optionValue = args.model.inputChoices[choice]
                    	//force strings
        				if(typeof optionValue === "number") optionValue = optionValue.toString()
                    	if(optionValue === args.model.value) selected = 'selected';
                    	else selected = '';
                        choiceOptions += selectOptionTemplate({optionName: choice, optionValue: optionValue, selected: selected})
                    }
                    args['options'] = choiceOptions;
                    //console.log(args.options)
                break;
                case "checkbox":
                    args['checked'] = args.model.value === true ? "checked" : "";
                break;
            }
            if(args.model.displayGroup === false && args.model.noTable === false) return columnTemplate({displayName: args.model.displayName, input: this.template(args)});
            else return this.template(args);
        }
        Proto.actions = {
            '.input': {
                'change': ['validateInput'],
                'blur': ['validateInput']
            }
        }
        Proto.serialize = function(){
            // var modObj = {}
            var formInput = this.DOM.find('.input')
            var formData;
            var model = this.getModel()
            switch(model.inputType){
                case "text":
                case "password":
                case "select":
                case "hidden":
                    formData = formInput.val();
                break;
                case "checkbox":
                    formData = formInput.is(":checked");
                break;
            }
            console.log(formData)
            model.modify({value: formData})
            // for(var i = 0; i < formData.length; i++){
            //     modObj[formData[i].name] = formData[i].value
            // }
            // model.modify({value: modObj[model.name]})
        }
    })
	form.InputFieldView = InputFieldView

    var FormMetaView = Class(DS.MetaView, function(Proto, Super){
        Proto.template = formTemplate;
        Proto.viewClass = InputFieldView;
        Proto.genViewDom = function(model){
        	var domHtml;
        	var mainFormDOM = this.DOM.find('.mainForm')
        	if(model.displayGroup === false && model.noTable === false){
        		return $("<div class = 'row'></div>").appendTo(mainFormDOM);
        	}else if(model.displayGroup !== false && model.noTable === false){
        		var displayGroup = this.DOM.find('.displayGroup'+model.displayGroup._id)
        		if(displayGroup.length === 0){
        			displayGroup = $("<div class = 'row displayGroup"+model.displayGroup._id+"'></div>").appendTo(mainFormDOM)
        			displayGroup.html(model.displayGroup.template({displayName: model.displayGroup.displayName}))
        		}
        		return $("<div class = 'viewGroupElement'></div>").appendTo(displayGroup.find(".inputColumn"))
        	}else{
                return $("<div></div>").appendTo(mainFormDOM);
            }

            //for viewgroups, simply add a new dom element if they don't exist, but also append to them if they do.
        }
        Proto.retrieveData = function(){
            var ro = {}
            var model;
            var validForm = true;
            for (var i = 0; i < this.models.elements.length; i++){
                model = DS.ModelRegistry[this.models.elements[i]];
                if(model.initialDisplay === true){
                    model.modify({initialDisplay: false})
                }
                if (model.valid !== "valid") validForm = false;
                ro[model.name] = model.value
            }
            if(validForm === false) return false;
            return ro;
        }
        Proto.serialize = function(){
            var view;
            for (var model in this.modelViews){
                view = DS.ViewRegistry[this.modelViews[model]]
                view.serialize()
            }
        }
        Proto.actions = {
            '.submit': {
                'click': ['submitForm']
            }
        }
    })
	form.FormMetaView = FormMetaView

	var FormController = Class(DS.Controller, function(Proto, Super){
    			Proto.events = {
                    'validateInput': function(_, view){
                        view.serialize()
                        var model = view.getModel()
                        if(model.initialDisplay === true){
                            model.modify({initialDisplay: false})
                        }
                    },
    				'submitForm': function(_, view){
    					view.serialize()
                        var submitData = view.retrieveData()
                        //if data is invalid
                        if(submitData === false) return;
    					console.log("submitting form with "+JSON.stringify(submitData))
    					//override this method with your submit code
    				}
    			}
    		})
	form.FormController = FormController

	exports.Form = form;

	//POPUP
	var popup = {}

    var popupTemplate = H.compile("\
        <div class = 'message'>{{{model.message}}}</div>\
        <div class = 'submit ok'>OK</div>\
        ")
    popup.popupTemplate = popupTemplate

	var PopupModel = Class(DS.Model, function(Proto, Super){
		Proto.message = '';
	})
	popup.PopupModel = PopupModel

	var PopupView = Class(DS.View, function(Proto, Super){
		Proto.template = popupTemplate;
		Proto.render = function(){
			Super.render.call(this)
			this.DOM.show()
		}
		Proto.actions = {
			'.ok': {
				'click': ['popupOk']
			}
		}
	})
	popup.PopupView = PopupView

	var PopupController = Class(DS.Controller, function(Proto, Super){
		Proto.events = {
			'popupOk': function(_, view){
				view.DOM.hide()
			}
		}
	})
	popup.PopupController = PopupController

	exports.Popup = popup;

	DS.Utils = exports;

})(jQuery, P, Handlebars, DeadSimpleMVC)

})();