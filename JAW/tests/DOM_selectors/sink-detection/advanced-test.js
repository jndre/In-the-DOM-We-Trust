

function func2(arg2){
    let a = arg2 + '2';
    localStorage.getItem(a);

    let b = document.querySelector('#input');
    return b;
}

function func3(arg3){
    let ret = document.getElementById(arg3);
    window.location = arg3;
    return ret;
}

function func4(arg4){
    window.location = arg4;
}

var aaa = document.querySelectorAll('.someid');
let bbb = "somethingfun";
var ccc = aaa + bbb;
var sd = func2(ccc);

func3(func2("somearg"));

func4(func2("somearg"));

window.location.assign(document.getElementsByClassName('className'));
document.location.href = document.querySelectorAll('.sths');
var aRandomNonSinkVar = document.querySelectorAll('sths');

var new_case = func2(bbb);
new_case = new_case + bbb;
func3(new_case);

let real = new XMLHttpRequest();
real.open('get', url = func3(func2(func2(aRandomNonSinkVar))));

let socket_obj = new WebSocket('TAINT', 'protocols');
socket_obj.send(document.querySelector('id'));

