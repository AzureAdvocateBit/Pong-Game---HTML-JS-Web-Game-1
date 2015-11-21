var lastUpdate = 0;
var player, ball, opponent, ai;
//the amount to move the players each step 
var distance = 24;
var score = [0, 0];

var Ball = function () {
    var velocity = [0, 0];
    var position = [0, 0];
    var element = $('#ball');
    var owner;
    var halfTile = 32;
    var paused = false;
//if there is an owner move the ball to match the owner position
    function move(t) {
        if (owner !== undefined) {
            var ownerPosition = owner.getPosition();
            position[1] = ownerPosition[1] + owner.getSize() / 2;
            if (owner.getSide() === 'left') {
                position[0] = ownerPosition[0] + owner.getSize();
            } else {
                position[0] = ownerPosition[0];
            }
            //Otherwise move the ball using physics. Note the horizontal bouncing has been removed - the ball will pass by the player if not caught
        } else {
            //If the ball hits the top or bottom, reverse the vertical speed
            if (position[1] - halfTile <= 0 ||
				  position[1] + halfTile >= innerHeight) {
                velocity[1] = -velocity[1];
            }
            position[0] += velocity[0] * t;
            position[1] += velocity[1] * t;
        }

        element.css('left', (position[0] - halfTile) + 'px');
        element.css('top', (position[1] - halfTile) + 'px');
    };

    function checkScored() {
        if (position[0] <= 0) {
            pause();
            // Opponent scored!
            $(document).trigger('ping:opponentScored');
        }

        if (position[0] >= innerWidth) {
            pause();
            // Player scored!
            $(document).trigger('ping:playerScored');
        }
    }

    function update(t) {
        // First we handle motion of the ball
        if (!paused) {
            move(t);
        }

        // The ball is under control of a player, so no need to update
        if (owner !== undefined) {
            return;
        }

        // First we check if the ball is about to be grabbed by the player
        var playerPosition = player.getPosition();
        if (position[0] <= player.getSize() &&
            position[1] >= playerPosition[1] &&
            position[1] <= playerPosition[1] + player.getSize()) {
            console.log("Grabbed by player!");
            owner = player;
        }

        // Then the opponent...
        var opponentPosition = opponent.getPosition();
        if (position[0] >= innerWidth - opponent.getSize() &&
           position[1] >= opponentPosition[1] &&
           position[1] <= opponentPosition[1] + opponent.getSize()) {
            console.log("Grabbed by opponent!");
            owner = opponent;
        }

        checkScored();
    }

    function pause() {
        paused = true;
    }

    function start() {
        paused = false;
    }

    return {
        update: update,
        pause: pause,
        start: start,
        getOwner: function () { return owner; },
        setOwner: function (o) { owner = o; },
        getVelocity: function () { return velocity },
        setVelocity: function (v) { velocity = v; },
        getPosition: function (p) { return position; },
    }
};
//player movement - creating a moveable player
var Player = function (elementName, side) {
    var position = [0, 0];
    //support for aimining
    var aim = 0;
    var tileSize = 128;

    var element = $('#' + elementName);
    //stopping a player
    var move = function (y) {
        //Adjusting the player position
        position[1] += y;
        //if the player is off the edge of the screen, move it back
        if (position[1] <= 0) {
            position[1] = 0;
        }
        //the height oif the player is 128 pixels so stop it before it goes off the screen
        if (position[1] >= innerHeight - tileSize) {
            position[1] = innerHeight - tileSize;
        }
        //if the player is meant to stick to the right side set the player position 
        if (side == 'right') {
            position[0] = innerWidth - tileSize;
        }
        //finally update the players position on the page
        element.css('left', position[0] + 'px');
        element.css('top', position[1] + 'px');
    }
    //fire function
    var fire = function () {
        //safely check if the ball doesnt have an owner 
        if (ball.getOwner() !== this) {
            return;
        }

        var v = [0, 0];

        if (side == 'left') {
            switch (aim) {
                case -1:
                    v = [.707, -.707];
                    break;
                case 0:
                    v = [1, 0];
                    break;
                case 1:
                    v = [.707, .707];
            }
        } else {
            switch (aim) {
                case -1:
                    v = [-.707, -.707];
                    break;
                case 0:
                    v = [-1, 0];
                    break;
                case 1:
                    v = [-.707, .707];
            }
        }
        ball.setVelocity(v);
        ball.setOwner(undefined);
    }

    return {
        move: move,
        fire: fire,
        getSide: function () { return side; },
        setAim: function (a) { aim = a; },
        getPosition: function () { return position; },
        getSize: function () { return tileSize; }
    }
};

function AI(playerToControl) {
    var ctl = playerToControl;
    var State = {
        WAITING: 0,
        FOLLOWING: 1,
        AIMING: 2
    }
    var currentState = State.FOLLOWING;

    function repeat(cb, cbFinal, interval, count) {
        var timeout = function () {
            repeat(cb, cbFinal, interval, count - 1);
        }
        if (count <= 0) {
            cbFinal();
        } else {
            cb();
            setTimeout(function () {
                repeat(cb, cbFinal, interval, count - 1);
            }, interval);
        }
    }

    function aimAndFire() {
        // We'll repeat the motion action 5 to 10 times
        var numRepeats = Math.floor(5 + Math.random() * 5);

        function randomMove() {
            if (Math.random() > .5) {
                ctl.move(-distance);
            } else {
                ctl.move(distance);
            }
        }

        function randomAimAndFire() {
            var d = Math.floor(Math.random() * 3 - 1);
            opponent.setAim(d);
            opponent.fire();

            // Finally, set the state to FOLLOWING
            currentState = State.FOLLOWING;
        }

        repeat(randomMove, randomAimAndFire, 250, numRepeats);
    }

    function moveTowardsBall() {
        if (ball.getPosition()[1] >= ctl.getPosition()[1] + ctl.getSize() / 2) {
            ctl.move(distance);
        } else {
            ctl.move(-distance);
        }
        setTimeout(function () {
            currentState = State.FOLLOWING;
        }, 400);
    }

    function update() {
        switch (currentState) {
            case State.FOLLOWING:
                if (ball.getOwner() === ctl) {
                    currentState = State.AIMING;
                    aimAndFire();
                } else {
                    moveTowardsBall();
                    currentState = State.WAITING;
                }
            case State.WAITING:
                break;
            case State.AIMING:
                break;
        }
    }

    return {
        update: update
    }
}

function update(time) {
    var t = time - lastUpdate;
    lastUpdate = time;

    ball.update(t);
    ai.update();

    requestAnimationFrame(update);
}

$(document).ready(function () {
    lastUpdate = 0;
    player = Player('player', 'left');
    player.move(0);
    opponent = Player('opponent', 'right');
    opponent.move(0);
    ball = Ball();
    ai = AI(opponent);
    ball.setOwner(player);

    $('#up').bind("pointerdown", function () { player.move(-distance); });
    $('#down').bind("pointerdown", function () { player.move(distance); });
    $('#left').bind("pointerdown", function () { player.setAim(-1); });
    $('#right').bind("pointerdown", function () { player.setAim(1); });
    $('#left').bind("pointerup", function () { player.setAim(0); });
    $('#right').bind("pointerup", function () { player.setAim(0); });

    requestAnimationFrame(update);
});

$(document).keydown(function (event) {
    var event = event || window.event;
    switch (String.fromCharCode(event.keyCode).toUpperCase()) {
        case 'A':
            player.move(-distance);
            break;
        case 'Z':
            player.move(distance);
            break;
        case 'K':
            player.setAim(-1);
            break;
        case 'M':
            player.setAim(1);
            break;
        case ' ':
            player.fire();
            break;
    }

    return false;
});

$(document).keyup(function (event) {
    var event = event || window.event;
    switch (String.fromCharCode(event.keyCode).toUpperCase()) {
        case 'K':
        case 'M':
            player.setAim(0);
            break;
    }

    return false;
});

$(document).on('ping:playerScored', function (e) {
    console.log('player scored!');
    score[0]++;
    $('#playerScore').text(score[0]);
    ball.setOwner(opponent);
    ball.start();
});

$(document).on('ping:opponentScored', function (e) {
    console.log('opponent scored!');
    score[1]++;
    $('#opponentScore').text(score[1]);
    ball.setOwner(player);
    ball.start();
});
