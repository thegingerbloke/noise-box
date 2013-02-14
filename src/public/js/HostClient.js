/*global _gaq*/
/**
 * NoiseBox
 * HomeClient.js
 *
 * Host page.
 */

define(["constants","AbstractClient","jquery"], function (Const,AbstractClient) {

    return AbstractClient.extend({

        currentTrack : null,
        audioElement : null,

        init : function () {
            this._super();
        },

        onConnect : function () {

            this._super();

            this.emit(Const.HOST_CONNECT);
        },


        onServerAddTrack : function (data) {

            console.log(data);

            this.playQueue.push(data);
            this.play();

            this._super(data);
        },


        onTrackComplete : function () {

            this.emit(Const.HOST_TRACK_COMPLETE,this.currentTrack);

            this.currentTrack = null;

            if (this.playQueue.length > 0) {
                this.play();
            }
        },


        play : function() {

            if (!this.currentTrack) {

                this.currentTrack = this.playQueue.shift();

                this.emit(Const.HOST_TRACK_PLAYING,this.currentTrack);

                // need to create a new audio element each time
                // can't just change the src of an existing element
                if (!!this.audioElement) {
                    this.audioElement.off('ended');
                    this.audioElement.off('loadedmetadata');
                    this.audioElement.remove();
                }

                this.audioElement = $("<audio />")
                    .attr("id", "audio-player")
                    .attr("preload", "auto")
                    .attr("src", this.currentTrack.track)
                    .appendTo("body");

                this.audioElement[0].play();

                this.audioElement.on('ended', $.proxy(this.onTrackComplete, this) );

                this.audioElement.on('loadedmetadata', function(e) {
                    console.log("track duration", Math.floor(this.duration));
                });

                _gaq.push(['_trackEvent','track', this.currentTrack.track, this.noiseBoxID]);

                // get track current time
                //this.audioElement.on('ontimeupdate', function(e) {
                //    console.log("time", Math.floor(this.currentTime) + ' / ' + Math.floor(this.duration));
                //});

            }
        }
    });
});