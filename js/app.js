!function($) {
  
  var map;
  var app = BBI.register({
    alias: 'TourToEnableApp',
    requires: ['google-maps'],
    author: 'Bobby Earl'
  });
  
  app.action('map', function(app, bbi, $) {
    return {
      
      init: function(options, element) {
        $.getJSON('trip.json', function(trip) {
          
          for (var i = 0, j = trip.waypoints.length; i < j; i++) {
            switch (trip.waypoints[i].type) {
              case 'poi':
                trip.waypoints[i].lng = trip.waypoints[i].location[0];
                trip.waypoints[i].lat = trip.waypoints[i].location[1]; 
                trip.waypoints[i].title = trip.waypoints[i].name;
              break;
            }
          }
          
          console.log(trip);
          
          var bbGoogleMaps = $(element).googleMaps({
            locations: trip.waypoints,
            map: {
              infoWindowTemplate: [
                '<div class="infoWindow">',
                '<h4>{{ title }}</h4>',
                '<p><a href="{{ poi.link }}" class="btn btn-primary btn-sm" target="_blank">Learn More</a></p>',
                '</div>'
              ].join(''),
              options: {
                zoom: 5,
                styles: [{"featureType":"water","stylers":[{"visibility":"on"},{"color":"#acbcc9"}]},{"featureType":"landscape","stylers":[{"color":"#f2e5d4"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#c5c6c6"}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#e4d7c6"}]},{"featureType":"road.local","elementType":"geometry","stylers":[{"color":"#fbfaf7"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#c5dac6"}]},{"featureType":"administrative","stylers":[{"visibility":"on"},{"lightness":33}]},{"featureType":"road"},{"featureType":"poi.park","elementType":"labels","stylers":[{"visibility":"on"},{"lightness":20}]},{},{"featureType":"road","stylers":[{"lightness":20}]}]
              }
            }
          }).data('plugin-google-maps');
          
          // Add the rough route
          var route = new google.maps.Polyline({
            path: google.maps.geometry.encoding.decodePath(trip.encoded_polyline),
            strokeColor: '#0000FF',
            strokeOpacity: .1,
            strokeWeight: 20
          });
          route.setMap(bbGoogleMaps.map); 
          
          // Add all the legs
          for (var i = 0, j = trip.legs.length; i < j; i++) {
            trip.legs[i].route = new google.maps.Polyline({
              path: google.maps.geometry.encoding.decodePath(trip.legs[i].encoded_polyline),
              strokeColor: '#FF0000',
              strokeOpacity: .3,
              strokeWeight: 2
            });
          
            trip.legs[i].route.setMap(bbGoogleMaps.map);            
          }
          
          $.getJSON('//s3.amazonaws.com/tour-to-enable/current-location.json', function(location) {
            var currentLocation = new google.maps.Marker({
              map: bbGoogleMaps.map,
              title: 'Current Location',
              animation: google.maps.Animation.DROP,
              position: new google.maps.LatLng(location.coords.latitude, location.coords.longitude),
              icon: 'img/wheel.png'
            });
            bbGoogleMaps.map.panTo(currentLocation.position);
          });
          
        });

      }
    }
  });
  
  app.build();
  
}(jQuery);