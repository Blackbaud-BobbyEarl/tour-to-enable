/*global angular */

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
                READING: 4
            }
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

                vm.sync = function () {
                    $timeout(function () {}, 0);
                };

                vm.showInfoWindow = function (event, id, data) {
                    for (var i in $scope.map.infoWindows) {
                        $scope.map.infoWindows[i].close();
                    };
                    $scope.data = data;
                    $scope.showInfoWindow.apply(this, [event, id]);
                };

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

                $http
                    .get('data/tour.json')
                    .success(function (data) {
                        vm.tour = data;
                        $scope.$on('mapInitialized', function (event, map) {
                            vm.tour.legs.forEach(function (el, idx) {
                                var decoded = google.maps.geometry.encoding.decodePath(vm.tour.encoded_polyline),
                                    border = new google.maps.Polyline({
                                        path: decoded,
                                        geodesic: true,
                                        strokeColor: '#eddfe2',
                                        strokeOpacity: .7,
                                        strokeWeight: 10
                                    }),
                                    poly = new google.maps.Polyline({
                                        path: decoded,
                                        geodesic: true,
                                        strokeColor: '#3d88b6',
                                        strokeOpacity: 1.0,
                                        strokeWeight: 2
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
                    vm.polling = !vm.polling;
                    localStorageService.set('polling', vm.polling);
                    vm.pollingStartStop();
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
                        .popup('github')
                        .done(function (result) {
                            vm.token = result.access_token;
                            localStorageService.set('token', vm.token);
                        })
                        .fail(function (error) {
                            vm.error = CONFIG.ERRORS.AUTH;
                            vm.errorDetails = error;
                        })
                        .always(function () {
                            vm.sync();
                        });
                };

                vm.isError = function (key) {
                    return vm.error === CONFIG.ERRORS[key];
                };

                vm.sync = function () {
                    $timeout(function () {}, 0);
                };

                // Previously asked to poll, start it back on page Load
                if (vm.polling) {
                    vm.pollingStartStop();
                }
            }
        ])
        .filter('unsafe', function ($sce) {
            return $sce.trustAsHtml;
        });
}());
