import {extendModel, Model} from "./model"
import {cast, checkAssertions, checkDefinition, extendDefinition} from "./definition"
import {extend, is, setConstructor, toString} from "./helpers"

const MUTATOR_METHODS = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift"]

export default function ArrayModel() {

	const model = function (array = model.default) {
		if (!is(model, this)) return new model(array)
		model.validate(array)
		return new Proxy(array, {
			getPrototypeOf: () => model.prototype,

			get(arr, key) {
				if (MUTATOR_METHODS.includes(key)) return proxifyMethod(arr, [][key], model)
				return arr[key]
			},

			set(arr, key, val) {
				return setArrayKey(arr, key, val, model)
			},

			deleteProperty(arr, key){
				return !(key in arr) || setArrayKey(arr, key, undefined, model)
			}
		})
	}

	extend(model, Array)
	setConstructor(model, ArrayModel)
	model._init(arguments)
	return model
}

extend(ArrayModel, Model, {
	toString(stack){
		return 'Array of ' + toString(this.definition, stack)
	},

	_validate(arr, path, errors, stack){
		if (is(Array, arr))
			arr.forEach((a, i) => {
				arr[i] = checkDefinition(a, this.definition, `${path || "Array"}[${i}]`, errors, stack, true)
			})
		else errors.push({
			expected: this,
			received: arr,
			path
		})

		checkAssertions(arr, this, path, errors)
	},

	extend(...newParts){
		return extendModel(new ArrayModel(extendDefinition(this.definition, newParts)), this)
	}
})

function proxifyMethod(array, method, model) {
	return function () {
		const testArray = array.slice()
		method.apply(testArray, arguments)
		model.validate(testArray)
		const returnValue = method.apply(array, arguments)
		array.forEach((a, i) => array[i] = cast(a, model.definition))
		return returnValue
	}
}

function setArrayKey(array, key, value, model) {
	let path = `Array[${key}]`;
	if (parseInt(key) === +key && key >= 0)
		value = checkDefinition(value, model.definition, path, model.errors, [], true)

	const testArray = array.slice()
	testArray[key] = value
	checkAssertions(testArray, model, path)
	const isSuccess = !model.unstackErrors()
	if (isSuccess) array[key] = value
	return isSuccess
}