/*

PINAPL.js


Changes between JPINAPL interpreter specs:
1) 255/255/x changed to 255/255/[0,1,2,3] to prevent collisions with 255/255/255 (pure white). This also frees up 255/255/[4-254]

//////

255/0/0 - START OF PROGRAM
0/0/255 - RETURN (will END PROGRAM if no position/direction is on the stack)
0/1/255 - FORCE QUIT
255/128/0 - ANTICLOCKWISE
255/0/128 - CLOCKWISE
255/128/128 - FORCE TURN
255/255/0 - SET DIRECTION TO UP
255/255/1 - SET DIRECTION TO RIGHT
255/255/2 - SET DIRECTION TO DOWN
255/255/3 - SET DIRECTION TO LEFT
255/200/200 - Don't execute next pixel ('trampoline')
255/128/255 - Set direction to a random direction

1/128/x - JUMP TO a JUMP TO TARGET, ID = x
2/128/x - JUMP TO TARGET, ID = x
1/200/x - CALL PROCEDURE, ID = x (matches PROCEDURE TARGET)
2/200/x - PROCEDURE TARGET, ID = x
3/x/y - PUSH Y ONTO STACK (but only if 4/x/* exists), CALL FUNCTION X
4/x/y - FUNCTION TARGET, ID = x, argument = y (if 3/x/y is called and no corresponding 4/x/y is found, the first occuring 4/x/* is used instead)
    (this allows you to exclude certain arguments)

125/x/y - SET INTEGER X TO VALUE OF INTEGER Y
126/x/y - SUBSTRACT INTEGER y FROM INTEGER x (RESULT IN INTEGER x)
127/x/y - SUBSTRACT VALUE y FROM INTEGER x
128/x/y - SET INTEGER x TO VALUE y
129/x/y - ADD VALUE y TO INTEGER x
130/x/y - ADD INTEGER y TO INTEGER x (RESULT IN INTEGER x)

120/x/y - COMPARE INTEGER x TO VALUE y (IF EQUAL, EXECUTE NEXT PROGRAM PIXEL; IF NOT, DO NOT EXECUTE IT).
121/x/y - COMPARE INTEGER x TO INTEGER y (IF EQUAL, EXECUTE NEXT PROGRAM PIXEL; IF NOT, DO NOT EXECUTE IT).
122/x/y - COMPARE INTEGER x TO INTEGER y (IF X>Y, EXECUTE NEXT PROGRAM PIXEL; IF NOT, DO NOT EXECUTE IT)

100/0/x - Push x onto the stack
100/1/x - Pop from the stack into INTEGER x
100/2/0 - Pop from the stack and output as ASCII (stdout)
100/3/x - Push INTEGER X onto the stack
100/255/255 - Pop from the stack (discard)
100/255/0 - Pop YXBGR and set pixel using those values
100/255/1 - Pop from PROGRAMSTACK, then push X, Y, Direction to the stack
100/255/2 - Pop Direction, Y, X. Push that to PROGRAMSTACK
100/255/3 - Push current stack size to the stack
100/255/4 - Pop YX and push RGB of pixel at (X,Y)


80/0/x - Output X as ASCII (stdout)
80/1/x - Output INTEGER X as ASCII (stdout)
80/2/x - Output INTEGER X (convert to string, output to stdout)

240/0/x - Ask for input, convert to integer and store in INTEGER X
240/1/0 - Ask for input, push input (ascii values) to stack
240/1/1 - Ask for input, push input (converted to integer) to stack

*/

var stack = [];
var ints = {};

var pPTR = {"x": 0, "y": 0, "dir": 0}
var pClockwise = true;
var pForceTurn = false;
var pForceBackwardsAllow = true; //first one should be allowed
var pExecute = true;

var imgcanvas = null;
var imgcontext = null;
var imgcontext1PIXEL = null;
var pStdout = "";


var funcs = {
    "0": {
        "0": {
            "255": function(r,g,b){ /* TODO: [0/0/255] : RETURN (will END PROGRAM if no position/direction is on the programstack) */ console.log("RETURNING"); }
        },
        "1": {
            "255": function(r,g,b){ /* TODO: [0/1/255] : FORCE QUIT */ console.log("QUITTING"); }
        }
    },
    "1": {
        "128": function(r,g,b){ 
        	/* [1/128/x] : JUMP TO a JUMP TO TARGET, ID = x */ 
        	var targets = getPixelCoordsRGB(2,128,b);
        	if (targets.length > 0) {
        		pPTR["x"] = targets[0]["x"];
        		pPTR["y"] = targets[0]["y"];
        	}
        	pForceBackwardsAllow = true;
        },
        "200": function(r,g,b){ /* TODO: [1/200/x] : CALL PROCEDURE, ID = x (matches PROCEDURE TARGET) */ }
    },
    "2": {
        "128": function(r,g,b){ /* [2/128/x] : JUMP TO TARGET, ID = x. Not a function. */ },
        "200": function(r,g,b){ /* TODO: [2/200/x] : PROCEDURE TARGET, ID = x */ }
    },
    "3": function(r,g,b){ /* TODO: [3/x/y] : PUSH Y ONTO STACK (but only if 4/x/* exists), CALL FUNCTION X */ },
    "4": function(r,g,b){ /* TODO: [4/x/y] : FUNCTION TARGET, ID = x, argument = y (if 3/x/y is called and no corresponding 4/x/y is found, the first occuring 4/x/* is used instead) (this allows you to exclude certain arguments) */ },
    "80": {
        "0": function(r,g,b){ 
        	/* [80/0/x] : Output X as ASCII (stdout) */ 
        	stdout(String.fromCharCode(b));
        },
        "1": function(r,g,b){ /* TODO: [80/1/x] : Output INTEGER X as ASCII (stdout) */ },
        "2": function(r,g,b){ 
        	/* [80/2/x] : Output INTEGER X (convert to string, output to stdout) */ 
        	stdout(ints[b].toString());
        }
    },
    "100": {
        "0": function(r,g,b){ 
        	/* [100/0/x] : Push x onto the stack */ 
        	stack.push(b);
        },
        "1": function(r,g,b){ 
        	/* [100/1/x] : Pop from the stack into INTEGER x */ 
        	//Maybe to do: check undefined?
        	ints[b] = stack.pop();
        },
        "2": {
            "0": function(r,g,b){ /* TODO: [100/2/0] : Pop from the stack and output as ASCII (stdout) */ }
        },
        "255": {
            "0": function(r,g,b){ 
            	/* [100/255/0] : Pop YXBGR and set pixel using those values */ 
            	var y = stack.pop();
            	var x = stack.pop();
            	var b = stack.pop();
            	var g = stack.pop();
            	var r = stack.pop();
            	setPixelColor(x,y,r,g,b);
            },
            "1": function(r,g,b){ /* TODO: [100/255/1] : Pop from PROGRAMSTACK, then push X, Y, Direction to the stack */ },
            "2": function(r,g,b){ /* TODO: [100/255/2] : Pop Direction, Y, X. Push that to PROGRAMSTACK */ },
            "255": function(r,g,b){ 
            	/* [100/255/255] : Pop from the stack (discard) */ 
            	stack.pop();
            },
            "3": function(r,g,b){ 
            	/* [100/255/3] : Push current stack size to the stack */ 
            	stack.push(stack.length);
            },
            "4": function(r,g,b){ 
            	/* [100/255/4] : Pop YX and push RGB of pixel at (X,Y) */ 
            	var y = stack.pop();
            	var x = stack.pop();
            	var rgb = getPixelColor(x,y);
            	stack.push(rgb['r']);
            	stack.push(rgb['g']);
            	stack.push(rgb['b']);
            }
        },
        "3": function(r,g,b){ 
        	/* [100/3/x] : Push INTEGER X onto the stack */ 
        	stack.push(ints[b]);
        }
    },
    "120": function(r,g,b){ 
    	/* [120/x/y] : COMPARE INTEGER x TO VALUE y (IF EQUAL, EXECUTE NEXT PROGRAM PIXEL; IF NOT, DO NOT EXECUTE IT). */ 
    	pExecute = false;
    	if (ints[g] === b) {
    		pExecute = true;
    	}
    },
    "121": function(r,g,b){ 
    	/* [121/x/y] : COMPARE INTEGER x TO INTEGER y (IF EQUAL, EXECUTE NEXT PROGRAM PIXEL; IF NOT, DO NOT EXECUTE IT). */ 
    	pExecute = false;
    	if (ints[g] === ints[b]) {
    		pExecute = true;
    	}
    },
    "122": function(r,g,b){ 
    	/* [122/x/y] : COMPARE INTEGER x TO INTEGER y (IF X>Y, EXECUTE NEXT PROGRAM PIXEL; IF NOT, DO NOT EXECUTE IT) */ 
    	pExecute = false;
    	if (ints[g] > ints[b]) {
    		pExecute = true;
    	}
    },
    "125": function(r,g,b){ 
    	/* [125/x/y] : SET INTEGER X TO VALUE OF INTEGER Y */ 
    	ints[g] = ints[b];
    },
    "126": function(r,g,b){ 
    	/* [126/x/y] : SUBSTRACT INTEGER y FROM INTEGER x (RESULT IN INTEGER x) */ 
    	ints[g] -= ints[b];
    },
    "127": function(r,g,b){ 
    	/* [127/x/y] : SUBSTRACT VALUE y FROM INTEGER x */ 
    	ints[g] -= b;
    },
    "128": function(r,g,b){ 
    	/* [128/x/y] : SET INTEGER x TO VALUE y */ 
    	ints[g] = b;
    },
    "129": function(r,g,b){ 
    	/* [129/x/y] : ADD VALUE y TO INTEGER x */ 
    	ints[g] += b;
    },
    "130": function(r,g,b){ 
    	/* [130/x/y] : ADD INTEGER y TO INTEGER x (RESULT IN INTEGER x) */ 
    	ints[g] += ints[b];
    },
    "240": {
        "0": function(r,g,b){ /* TODO: [240/0/x] : Ask for input, convert to integer and store in INTEGER X */ },
        "1": {
            "0": function(r,g,b){ /* TODO: [240/1/0] : Ask for input, push input (ascii values) to stack */ },
            "1": function(r,g,b){ /* TODO: [240/1/1] : Ask for input, push input (converted to integer) to stack */ }
        }
    },
    "255": {
        "0": {
            "0": function(r,g,b){ /* TODO: [255/0/0] : START OF PROGRAM */ },
            "128": function(r,g,b){ 
            	/* [255/0/128] : CLOCKWISE */ 
            	pClockwise = true;
            }
        },
        "128": {
            "0": function(r,g,b){ 
            	/* [255/128/0] : ANTICLOCKWISE */ 
            	pClockwise = false;
            },
            "128": function(r,g,b){ 
            	/* [255/128/128] : FORCE TURN */ 
            	pForceTurn = true;
            },
            "255": function(r,g,b){ 
            	/* [255/128/255] : Set direction to a random direction */ 
            	pPTR["dir"] = parseInt(Math.random()*4);
            }
        },
        "200": {
            "200": function(r,g,b){ 
            	/* [255/200/200] : Don't execute next pixel ('trampoline') */
            	pExecute = false; 
            }
        },
        "255": {
        	"0": function(r,g,b){
        		/* [255/255/0] : SET DIRECTION TO UP */
        		pPTR["dir"] = 0;
        	},
        	"1": function(r,g,b){
        		/* [255/255/1] : SET DIRECTION TO RIGHT */
        		pPTR["dir"] = 1;
        	},
        	"2": function(r,g,b){
        		/* [255/255/2] : SET DIRECTION TO DOWN */
        		pPTR["dir"] = 2;
        	},
        	"3": function(r,g,b){
        		/* [255/255/3] : SET DIRECTION TO LEFT */
        		pPTR["dir"] = 3;
        	}
        }
    }
}

var parseInput = function(input) {
	for (var i = 0; i < input.length; i++) {
		pixel = input[i];
		runFunc(pixel[0], pixel[1], pixel[2]);
	}
}

var runFunc = function(r,g,b) {
	var funcptr = null;
	if (typeof funcs[r] == "function") {
		funcptr = funcs[r];
	} else if (typeof funcs[r][g] == "function") {
		funcptr = funcs[r][g];
	} else if (typeof funcs[r][g][b] == "function") {
		funcptr = funcs[r][g][b];
	} else {
		//do nothing; it's a NOP pixel
	}

	if (typeof funcptr == "function") {
		funcptr(r,g,b);
		var fnc = funcptr.toString();
		if (fnc.indexOf("TODO") != -1) {
			console.error("TODOFUNC: " + fnc);
		}
	}
}

var initSetup = function() {
	for (var i = 0; i < 256; i++) {
		ints[i] = 0;
	}
}

var getPixelColor = function(x, y) {
	var data = imgcontext.getImageData(x, y, 1, 1).data;
	return {
		"r": data[0],
		"g": data[1],
		"b": data[2]
	}
}

var setPixelColor = function(x,y,r,g,b) {
	var d  = imgcontext1PIXEL.data;
	d[0]   = r;
	d[1]   = g;
	d[2]   = b;
	d[3]   = 255;
	imgcontext.putImageData(imgcontext1PIXEL, x, y);  
}

var getPixelCoordsRGB = function(r, g, b) {
	var retarr = [];
	for (var y = 0; y < imgcanvas.height; y++) {
		for (var x = 0; x < imgcanvas.width; x++) {
			var col = getPixelColor(x, y);
			if (col["r"] == r && col["g"] == g && col["b"] == b) {
				retarr.push({"x": x, "y": y});
			}
		}
	}
	return retarr;
}

var setCanvas = function(canvas) {
	imgcanvas = canvas;
	imgcontext = canvas.getContext('2d');
	imgcontext1PIXEL = imgcontext.createImageData(1,1); //Create a 1x1 pixel context
}


/*var setPPTR = function(newptr) {
	pPTR["x"] = newptr["x"];
	pPTR["y"] = newptr["y"];
	pPTR["dir"] = newptr["dir"];
}*/

var initPinapl = function(canvas) {
	setCanvas(canvas);
	var t = getPixelCoordsRGB(255,0,0)[0];
	pPTR["x"] = t["x"];
	pPTR["y"] = t["y"];
}

var step = function() {
	var newptr = findNext();
	pPTR["x"] = newptr["x"];
	pPTR["y"] = newptr["y"];
	pPTR["dir"] = newptr["dir"];
	pForceBackwardsAllow = false; //immediately set it to false; this only applies to one pixel step only.
	if (pExecute === true) {
		var pcol = getPixelColor(pPTR["x"], pPTR["y"]);
		//console.log(pcol["r"] + "/" + pcol["g"] + "/" + pcol["b"] + " @ " + pPTR["x"] + "/" + pPTR["y"] + ":" + pPTR["dir"]);
		runFunc(pcol["r"], pcol["g"], pcol["b"]);
	} else {
		pExecute = true;
	}
}

var stdout = function(text) {
	pStdout += text;
}

var stdoutFlush = function() {
	var txta = $("#output");
	txta.val(txta.val() + pStdout);
	pStdout = "";
}


var findNext = function() {
	checklist = [];
    if (!pForceTurn) {
        checklist.push(0);
    }
    if (pClockwise) {
        checklist.push(1);
        if (pForceBackwardsAllow) {
            checklist.push(2);
        }
        checklist.push(3);
    } else {
        checklist.push(3);
        if (pForceBackwardsAllow) {
            checklist.push(2);
        }
        checklist.push(1);
    }
    if (pForceTurn) {
        checklist.push(0);
    }

    for (var j = 0; j < checklist.length; j++) {
        if (checkdir(pPTR["dir"] + checklist[j], pPTR["x"], pPTR["y"])) {
            if ((checklist[j] == 1 || checklist[j] == 3) && pForceTurn) {
                pForceTurn = false;
            }
            var retval = getpointfromdir(pPTR["x"], pPTR["y"], pPTR["dir"] + checklist[j]);
            retval["dir"] = (pPTR["dir"] + checklist[j]) % 4;
            return retval;
        }
    }
    return {"x": -1, "y": -1, "dir": -1};
}

var getpointfromdir = function(lx, ly, dir) {
    var tx = 0;
    var ty = 0;
    if (dir < 0) {
        dir = dir + 4;
    }
    switch (dir % 4) {
        case 0:
            tx = lx;
            ty = ly - 1;
            break;
        case 1:
            tx = lx + 1;
            ty = ly;
            break;
        case 2:
            tx = lx;
            ty = ly + 1;
            break;
        case 3:
            tx = lx - 1;
            ty = ly;
            break;
    }
    return {"x":tx, "y":ty};
}

var checkdir =  function(dir, tx, ty) {
    var tpoint = getpointfromdir(pPTR["x"], pPTR["y"], dir);
    if (tpoint["x"] < 0 || tpoint["x"] >= imgcanvas.width || tpoint["y"] < 0 || tpoint["y"] >= imgcanvas.height) {
        return false;
    }
    var pxcol = getPixelColor(tpoint["x"], tpoint["y"]);
    if (!(pxcol["r"] == 0 && pxcol["g"] == 0 && pxcol["b"] == 0)) {
        return true;
    } else {
        return false;
    }
}


///////////////////

/*var input = [
	[100,0,1],
	[100,0,2]
]
parseInput(input);
console.log(stack);
console.log(ints);*/