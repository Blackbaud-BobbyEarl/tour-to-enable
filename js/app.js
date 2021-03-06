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
                query = new Parse.Query(Tour);
            return {
                Tour: Tour,
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

                vm.legs = [
                    '5697538',
                    '5697619',
                    '5698490',
                    '5698548',
                    '5698556',
                    '5698589',
                    '5698662',
                    '5698698'
                ];

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

                function showStravaRoute(url) {
                    $http
                        .get(url)
                        .success(function (route) {
                            $scope.$on('mapInitialized', function (event, map) {
                                var decoded = google.maps.geometry.encoding.decodePath(route.map.polyline),
                                    poly = new google.maps.Polyline({
                                        path: decoded,
                                        geodesic: true,
                                        strokeColor: '#3d88b6',
                                        strokeOpacity: 1.0,
                                        strokeWeight: 4
                                    });
                                poly.setMap(map);
                            });
                        });
                }

                vm.legs.forEach(function (id) {
                    showStravaRoute('data/' + id + '.json');
                });

                // Show current location
                // TourService.query.find({
                //     success: function (results) {
                //         vm.locations = results;
                //         vm.lastLocation = results[results.length - 1];
                //         vm.sync();
                //     },
                //     error: function (error) {
                //         vm.error = CONFIG.ERRORS.READING;
                //         vm.errorDetails = error;
                //     }
                // });

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
                            var tour = new TourService.Tour();
                            tour.save({
                                accuracy: position.coords.accuracy,
                                altitude: position.coords.altitude,
                                altitudeAccuracy: position.coords.altitudeAccuracy,
                                heading: position.coords.heading,
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                speed: position.coords.speed
                            }, {
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
