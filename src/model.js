function Model(def){
	if(!isLeaf(def)) return new Model.Object(def);

	var model = function(obj) {
		model.validate(obj, []);
		return obj;
	};

	return initModel(model, Model, Object.create(isFunction(def) ? def.prototype : null), def);
}

Model.prototype = Object.create(Function.prototype);

Model.prototype.toString = function(ndeep){
	return toString(this.definition, ndeep);
};

Model.prototype.validate = function(obj, stack){
	checkModel(obj, this.definition, undefined, stack);
	matchAssertions(obj, this.assertions);
};

Model.prototype.extend = function(){
	var submodel = new this.constructor(mergeDefinitions(this.definition, arguments));
	submodel.prototype = Object.create(this.prototype);
	submodel.prototype.constructor = submodel;
	submodel.assertions = cloneArray(this.assertions);
	return submodel;
};

Model.prototype.assert = function(){
	this.assertions = this.assertions.concat(cloneArray(arguments).filter(isFunction));
	return this;
};

function initModel(model, constructor, proto, def){
	model.constructor = constructor;
	model.prototype = proto;
	model.prototype.constructor = model;
	model.definition = def;
	model.assertions = [];
	Object.setPrototypeOf(model, constructor.prototype);
    if(!canSetProto && Object.defineProperty){ // ugly fallback for Object.setPrototypeOf
        Object.defineProperty(model, "__model__", { enumerable: false });
    }
	return model;
}

function isLeaf(def){
	return bettertypeof(def) != "Object";
}

function mergeDefinitions(base, exts){
	if(exts.length === 0) return base;
	if(isLeaf(base)){
		return cloneArray(exts).reduce(function(def, ext){ return def.concat(parseDefinition(ext)); }, parseDefinition(base)).filter(onlyUnique);
	} else {
		return cloneArray(exts).reduce(function(def, ext){ return merge(ext || {}, def); }, base);
	}
}

function parseDefinition(def){
	if(isLeaf(def)){
		if(!isArray(def)) {
			return [def];
		} else if(def.length === 1){
			return def.concat(undefined);
		}
	} else {
		Object.keys(def).forEach(function(key) {
			def[key] = parseDefinition(def[key]);
		});
	}
	return def;
}

function checkModel(obj, def, path, stack){
	if(isLeaf(def)){
		checkDefinitions(obj, def, path, stack.concat(def));
	} else {
		Object.keys(def).forEach(function(key) {
			var val = obj instanceof Object ? obj[key] : undefined;
			checkModel(val, def[key], path ? path + '.' + key : key, stack.concat(val));
		});
	}
}

function checkDefinitions(obj, _def, path, stack){
	var def = parseDefinition(_def);
	for(var i= 0, l=def.length; i<l; i++){
		if(checkDefinitionPart(obj, def[i], stack)){ return; }
	}
	throw new TypeError("expecting " + (path ? path + " to be " : "") + def.map(toString).join(" or ")
					+ ", got " + (obj != null ? bettertypeof(obj) + " " : "") + toString(obj) );

}

function checkDefinitionPart(obj, def, stack){
	if(obj == null){
		return obj === def;
	}
	if(def instanceof Model || (def && def.hasOwnProperty("__model__"))){
		var indexFound = stack.indexOf(def);
		if(indexFound !== -1 && stack.slice(indexFound+1).indexOf(def) !== -1){
			return true; //if found twice in call stack, cycle detected, skip validation
		}
		try { def.validate(obj, stack.concat(def)); return true; }
		catch(e){ return false; }
	}
	if(def instanceof RegExp){
		return def.test(obj);
	}
	return obj === def
		|| (isFunction(def) && obj instanceof def)
		|| obj.constructor === def;
}

function matchAssertions(obj, assertions){
	for(var i=0, l=assertions.length; i<l ; i++ ){
		if(!assertions[i](obj)){
			throw new TypeError("an assertion of the model is not respected: "+toString(assertions[i]));
		}
	}
}