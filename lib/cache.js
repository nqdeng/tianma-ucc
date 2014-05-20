var util = require('pegasus').util;

var Cache = util.inherit(Object, {
		_initialize: function (config) {
			var max = config.max,
				i = 0,
				items = this._items = [];

			this._map = {};
			this._ptr = 0;

			for (; i < max; ++i) {
				items[i] = {
					count: 0,
					key: '',
					mtime: '',
					value: null
				};
			}
		},

		dump: function () {
			console.log('ptr: %d', this._ptr);
			this._items.forEach(function (item) {
				console.log(JSON.stringify(item));
			});
			console.log('---');
		},

		get: function (key, mtime) {
			var map = this._map,
				item, value;

			if (map.hasOwnProperty(key)) {
				item = map[key];

				if (item.mtime === mtime) {
					item.count += 1;
					value = item.value;
				} else {
					// Remove dirty item.
					delete map[key];
					item.count = 0;
				}
			}

			return value;
		},

		set: function (key, mtime, value) {
			var items = this._items,
				last = items.length - 1,
				ptr = this._ptr,
				map = this._map,
				item, done;

			while (true) {
				item = items[ptr];

				if (item.count === 0) {
					// Remove old item.
					delete map[item.key];

					// Add new item.
					map[key] = item;
					item.key = key;
					item.mtime = mtime;
					item.value = value;

					// Break the loop.
					done = true;
				} else {
					item.count -= 1;
				}

				if (ptr === last) {
					ptr = 0;
				} else {
					ptr += 1;
				}

				if (done) {
					break;
				}
			}

			// Save the pointer.
			this._ptr = ptr;
		}
	});

exports.create = function (config) {
	return new Cache(config);
};
