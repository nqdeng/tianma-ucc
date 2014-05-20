var Cache = require('./cache');

var c = new Cache({ max: 3 });


c.set('a', '1', 'a');
c.dump();
c.set('b', '2', 'b');
c.dump();
c.set('c', '3', 'c');
c.dump();
console.log(c.get('a', '1'));
c.dump();
console.log(c.get('a', '1'));
c.dump();
c.set('d', '4', 'd');
c.dump();
