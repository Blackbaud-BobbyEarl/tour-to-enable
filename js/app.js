/*global angular, google, console, navigator, CONFIG, OAuth, Parse */

(function () {
    'use strict';
    angular
        .module('TourToEnable', ['ui.router', 'ngMap', 'angularMoment', 'LocalStorageModule'])
        .constant('CONFIG', {
            ERRORS: {
                NONE: null,
                POSITION: 1,
                AUTH: 2,
                WRITING: 3,
                READING: 4,
                ACCESS: 5
            },
            USERS: [
                'bobby@simplyearl.com',
                'ben@room25.com'
            ]
        })
        .config(function ($stateProvider, $urlRouterProvider) {
            OAuth.initialize('0xbRhzdwzC5maT0FxiVtpfQRvwk');
            Parse.initialize(
                "1XvMsozNVSijGVnJKYrtjshlWTw5KldsxKyLQKQ9",
                "MaI5yzYOm2VbvVGXP5DbdU1Wa5tRNGrBrTDX9CzR"
            );
            $urlRouterProvider.otherwise('/tour');
            $stateProvider
                .state('map', {
                    url: '/tour',
                    templateUrl: 'views/tour.html'
                })
                .state('admin', {
                    url: '/admin',
                    templateUrl: 'views/admin.html'
                });
        })
        .service('TourService', function () {
            var Tour = Parse.Object.extend('Tour'),
                query = new Parse.Query(Tour),
                tour = new Tour();
            return {
                tour: tour,
                query: query
            };
        })
        .controller('TourController', [
            '$scope',
            '$http',
            '$timeout',
            'TourService',
            function ($scope, $http, $timeout, TourService) {

                var vm = this;

                vm.legs = [];

                vm.sync = function () {
                    $timeout(function () {}, 0);
                };

                vm.showInfoWindow = function (event, id, data) {
                    var i;
                    for (i in $scope.map.infoWindows) {
                        if ($scope.map.infoWindows[i]) {
                            $scope.map.infoWindows[i].close();
                        }
                    }
                    $scope.data = data;
                    $scope.showInfoWindow.apply(this, [event, id]);
                };

                function showPath(json, reverse, config) {
                    var path = [];
                    json.points[0].forEach(function (leg) {
                        leg.forEach(function (point) {
                            path.push(new google.maps.LatLng(point[reverse ? 1 : 0], point[reverse ? 0 : 1]));
                        });
                    });
                    $scope.$on('mapInitialized', function (event, map) {
                        var poly = new google.maps.Polyline({
                            path: path,
                            geodesic: true,
                            strokeColor: config.strokeColor || '#000000',
                            //strokeOpacity: config.strokeOpacity || 1,
                            strokeOpacity: 0,
                            strokeWeight: config.strokeWeight || 2,
                            icons: [{
                                icon: {
                                    path: 'M 0,-1 0,1',
                                    strokeOpacity: 0.2,
                                    scale: 4
                                },
                                offset: '0',
                                repeat: '20px'
                            }]
                        });

                        poly.setMap(map);
                        vm.sync();
                    });
                }

                function showEncodedPath(url) {
                    $http
                        .get(url)
                        .success(function (tour) {
                            vm.legs.push(tour);
                            $scope.$on('mapInitialized', function (event, map) {
                                tour.legs.forEach(function () {
                                    var decoded = google.maps.geometry.encoding.decodePath(tour.encoded_polyline),
                                        border = new google.maps.Polyline({
                                            path: decoded,
                                            geodesic: true,
                                            strokeColor: '#eddfe2',
                                            strokeOpacity: 0.7,
                                            strokeWeight: 20
                                        }),
                                        poly = new google.maps.Polyline({
                                            path: decoded,
                                            geodesic: true,
                                            strokeColor: '#3d88b6',
                                            strokeOpacity: 1.0,
                                            strokeWeight: 4
                                        });
                                    border.setMap(map);
                                    poly.setMap(map);
                                });
                                vm.sync();
                            });
                        })
                        .error(function (error) {
                            console.log(error);
                        });
                }

                // Show encoded paths
                showEncodedPath('data/tour-leg1.json');
                showEncodedPath('data/tour-leg2.json');

                // Show train path
                $http.get('data/route-train.json').success(function (data) {
                    showPath(data, true, {
                        strokeWeight: 1,
                        strokeColor: '#000000',
                        strokeOpacity: 0
                    });
                });

                // Show Instagram checkins
                $http
                    .get('https://developer.blackbaud.com/proxy/?mode=native&url=' + encodeURIComponent('https://api.instagram.com/v1/users/1464249720/media/recent?access_token=4355.1fb234f.353294207c1e4279808b5e25e19f0d55'))
                    .then(function (response) {
                        vm.instagram = response.data.data;
                    }, function () {
                        console.log('error loading instagram feed');
                    });

                // Show current location
                TourService.query.find({
                    success: function (results) {
                        vm.locations = results;
                        vm.lastLocation = results[results.length - 1];
                        vm.sync();
                    },
                    error: function (error) {
                        vm.error = CONFIG.ERRORS.READING;
                        vm.errorDetails = error;
                    }
                });
            }
        ])
        .controller('AdminController', [
            '$scope',
            '$timeout',
            '$interval',
            'localStorageService',
            'TourService',
            'CONFIG',
            function ($scope, $timeout, $interval, localStorageService, TourService, CONFIG) {

                var vm = this,
                    clearInterval;

                vm.errorDetails = {};
                vm.error = CONFIG.ERRORS.NONE;
                vm.updating = false;
                vm.success = false;
                vm.polling = localStorageService.get('polling');
                vm.token = localStorageService.get('token');

                vm.update = function () {
                    vm.updating = true;
                    navigator.geolocation.getCurrentPosition(
                        function (position) {
                            TourService.tour.add('locations', {
                                accuracy: position.coords.accuracy,
                                altitude: position.coords.altitude,
                                altitudeAccuracy: position.coords.altitudeAccuracy,
                                heading: position.coords.heading,
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                speed: position.coords.speed
                            });
                            TourService.tour.save(null, {
                                success: function () {
                                    vm.updating = false;
                                    vm.success = true;
                                    vm.sync();
                                    $timeout(function () {
                                        vm.success = false;
                                        vm.sync();
                                    }, 2000);
                                },
                                error: function (data, error) {
                                    vm.updating = false;
                                    vm.error = CONFIG.ERRORS.WRITING;
                                    vm.errorDetails = error;
                                }
                            });
                            vm.sync();
                        },
                        function (error) {
                            vm.updating = false;
                            vm.error = CONFIG.ERRORS.POSITION;
                            vm.errorDetails = error;
                            vm.sync();
                        }
                    );
                };

                vm.togglePolling = function () {
                    var audio = document.getElementsByTagName('audio')[0];
                    vm.polling = !vm.polling;
                    localStorageService.set('polling', vm.polling);
                    vm.pollingStartStop();
                    if (vm.polling) {
                        audio.play();
                    } else {
                        audio.pause();
                    }
                };

                vm.pollingStartStop = function () {
                    if (vm.polling) {
                        clearInterval = $interval(vm.update, 10000);
                    } else {
                        $interval.cancel(clearInterval);
                    }
                };

                vm.login = function () {
                    OAuth
                        .popup('facebook')
                        .done(function (result) {
                            result.me().done(function (data) {
                                if (CONFIG.USERS.indexOf(data.email) === -1) {
                                    vm.error = CONFIG.ERRORS.ACCESS;
                                } else {
                                    vm.token = result.access_token;
                                    localStorageService.set('token', vm.token);
                                }
                                vm.sync();
                            });
                        })
                        .fail(function (error) {
                            vm.error = CONFIG.ERRORS.AUTH;
                            vm.errorDetails = error;
                        })
                        .always(function () {
                            vm.sync();
                        });
                };

                vm.logout = function () {
                    vm.token = '';
                    localStorageService.set('token', vm.token);
                };

                vm.isError = function (key) {
                    return vm.error === CONFIG.ERRORS[key];
                };

                vm.sync = function () {
                    $timeout(function () {}, 0);
                };

                // Previously asked to poll, start it back on page Load
                // Disabling this since I can't autoplay the audio
                // if (vm.polling) {
                //     vm.pollingStartStop();
                // }
            }
        ])
        .filter('unsafe', function ($sce) {
            return $sce.trustAsHtml;
        });
}());
