/**
 * NoiseBox
 * host.js
 *
 * Host route controller.
 */

var server = require("./../../server");
var app = server.app;
var io = server.io;
var model = server.model;
var constants = server.constants;
var templateOptions = require("./../middleware/template-options");
var stats = require("./../middleware/stats");

module.exports = function () {

    // Map route to middleware and rendering function:

    app.get("/host/:id",templateOptions(),stats(),function (req,res) {

        var id = req.params.id;

        if ( !model.noiseBoxExists(id) ) {

            req.session.flashMessage = "NoiseBox '"+id+"' does not exist.";
            res.redirect("/");
            return;
        }

        res.extendTemplateOptions({
            title: "Hosting " + id + " | " + res.templateOptions.title,
            clientType:constants.TYPE_HOST,
            userURL : res.templateOptions.host+"/"+id,
            id : id
        });

        res.render(constants.TYPE_HOST,res.templateOptions);
    });

    app.post("/host",function (req,res) {

        var id = req.body.id;

        var msg;
        var error = false;

        if ( typeof id === "undefined" ) {
            error = true;
            msg = "Uh oh, something's wrong. Try again later ...";
        }

        if ( !isValidNoiseBoxID(id) ) {
            error = true;
            msg = "That isn't a valid NoiseBox name. The name must be 20 characters or less and consist only of letters and numbers with no spaces.";
        }

        if ( model.noiseBoxExists(id) ) {
            error = true;
            msg = "Unable to create that NoiseBox, try a different name ...";
        }

        if ( error ) {
            req.session.flashMessage = msg;
            res.redirect("/");
        } else {
            console.log("Created NoiseBox '%s'",id);
            model.addNoiseBox(id);
            res.redirect("/host/"+id);
        }
    });

    // Attach socket events:

    io.sockets.on(constants.CLIENT_SOCKET_CONNECTION,function (socket) {

        socket.on(constants.HOST_CONNECT,function (data) {
            onConnect(data,socket);
        });

        socket.on(constants.SOCKET_DISCONNECT,function (data) {
            onDisconnect(data,socket);
        });
    });

    // Start listening for updates from the model:

    model.on(constants.USER_ADDED,updateNoiseBoxStats);
    model.on(constants.USER_REMOVED,updateNoiseBoxStats);
    model.on(constants.USER_ADDED,userChanged);
    model.on(constants.USER_UPDATED,userChanged);
    model.on(constants.USER_REMOVED,userChanged);
    model.on(constants.HOST_ADDED,updateNoiseBoxStats);
    model.on(constants.HOST_ADDED,listUsers);
    model.on(constants.HOST_REMOVED,updateNoiseBoxStats);
    model.on(constants.TRACK_ADDED,trackAdded);
    model.on(constants.TRACK_REMOVED,trackRemoved);

    /**
     * Called when a host client socket has connected.
     *
     * @param data Data object sent from client.
     * @param socket Socket instance for the client.
     */
    function onConnect (data,socket) {

        var nb = model.getNoiseBox(data.id);

        if ( !nb ) { return; }

        console.log("Created host '%s' for NoiseBox '%s'",socket.id,data.id);

        nb.addHost(socket.id,socket);
    }

    /**
     * Generic socket disconnect. This callback is called when *any* socket disconnects (not just
     * host clients) so we need to check that the disconnecting client is a host, and if so remove
     * it from the model.
     *
     * @param data Data object sent from the client.
     * @param socket Socket instance that has disconnected.
     */
    function onDisconnect (data,socket) {

        var nb = model.getNoiseBoxByClientSocketID(socket.id);

        if ( !nb ) { return; }

        if ( nb.hostExists(socket.id) ) {

            console.log("Removed host '%s' for NoiseBox '%s'",socket.id,nb.id);

            nb.removeHost(socket.id);
        }
    }


    /**
     * A NoiseBox track has been added, so loop through the box's hosts and tell them to
     * each add the track.
     *
     * @param nbTrackModel The NBTrackModel instance which has its track property
     * @param nb The NBModel instance
     */
    function trackAdded (nbTrackModel, nb) {

        console.log(nbTrackModel.toJSON(), nbTrackModel.cid);

        nb.hosts.each(function (host) {

            host.get("socket").emit(constants.SERVER_ADD_TRACK,{ track: nbTrackModel.get("track"), cid: nbTrackModel.cid });
        });
    }



    /**
     * A NoiseBox track has been removed, so loop through the box's hosts and tell them to
     * each remove the track.
     *
     * @param nbTrackModel The NBTrackModel instance which has its track property
     * @param nb The NBModel instance
     */
    function trackRemoved (nbTrackModel, nb) {

        nb.hosts.each(function (host) {

            host.get("socket").emit(constants.SERVER_REMOVE_TRACK,{track:nbTrackModel.get("track")});
        });
    }


    /**
     * A NoiseBox client (user or host) has been added or removed so we need to loop through all the
     * hosts for the client's NoiseBox and tell them to update their stats.
     *
     * @param nbClient NBHost or NBUser instance that has been added or removed.
     */
    function updateNoiseBoxStats (nbClient) {

        var nb = model.getNoiseBox(nbClient.get("parentNoiseBoxID"));

        if ( !nb ) { return; }

        nb.hosts.each(function (host) {

            host.get("socket").emit(constants.SERVER_NOISE_BOX_STATS_UPDATED,{numHosts:nb.hosts.length,numUsers:nb.users.length});
        });
    }


    /**
     * When a NoiseBox host is added, list any users who are already connected
     *
     * @param nbClient NBHost instance that has been added
     */
    function listUsers (nbHost) {

        var nb = model.getNoiseBox(nbHost.get("parentNoiseBoxID"));

        if ( !nb ) { return; }

        nb.users.each(function (user) {
            nbHost.get("socket").emit(constants.USER_ADDED, {username: user.get("username"), id: user.get("id")});
        });
    }


    /**
     * A NoiseBox user has been added/updated/removed so we need to update the username list
     *
     * @param nbClient NBUser instance that has been added/updated/removed
     */
    function userChanged (nbUser, eventType) {

        var nb = model.getNoiseBox(nbUser.get("parentNoiseBoxID"));

        if ( !nb ) { return; }

        nb.hosts.each(function (host) {
            host.get("socket").emit(eventType, {username: nbUser.get("username"), id: nbUser.get("id")});
        });
    }


    /**
     * Validate a NoiseBox id.
     */
    function isValidNoiseBoxID (id) {

        var valid = true;

        if ( typeof id !== "string" ) {
            valid = false;
        }

        if ( id === "" ) {
            valid = false;
        }

        if ( id.length > 20 ) {
            valid = false;
        }

        if ( !id.match(/^[a-zA-Z0-9]+$/) ) {
            valid = false;
        }

        return valid;
    }
};