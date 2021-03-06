var rackspace = require('../rackspace-openstack'),
    _ = require('underscore');


exports.CloudDns = {

    /**
     * @name Client.getDomains
     *
     * @description getDomains retrieves your list of domains
     *
     * @param {Object|Function}     details     provides filters on your domains request
     * @param {Function}            callback    handles the callback of your api call
     */
    getDomains: function(details, callback) {
        var self = this;

        if (typeof(details) === 'function') {
            callback = details;
            details = {};
        }

        var requestOptions = {
            uri: '/domains',
            endpoint: rackspace.Endpoints.CloudDns
        };

        requestOptions.qs = _.pick(details,
            'name');

        self.authorizedRequest(requestOptions, function(err, res, body) {
            if (err || !body.domains) {
                callback(err);
                return;
            }

            var domains = [];

            for (var i = 0; i < body.domains.length; i++) {
                domains.push(new rackspace.Domain(self, body.domains[i]));
            }

            callback(err, domains);
        });
    },

    /**
     * @name Client.getDomain
     *
     * @description Gets the details for a specified domain id
     *
     * @param {String}      id          the domain id of the requested domain
     * @param {Function}    callback    handles the callback of your api call
     */
    getDomain: function(id, callback) {
        var self = this;

        var requestOptions = {
            uri: '/domains/' + id,
            endpoint: rackspace.Endpoints.CloudDns
        };

        self.authorizedRequest(requestOptions, function(err, res, body) {
            if (err || !body) {
                callback(err);
                return;
            }

            callback(err, new rackspace.Domain(self, body));
        });
    },

    /**
     * @name Client.createDomain
     *
     * @description register a new domain in the rackspace domain manager
     *
     * @param {Object}     details     the information for your new domain
     * @param {Function}   callback    handles the callback of your api call
     */
    createDomain: function(details, callback) {
        this.createDomains([ details ], function(err, domains) {
            if (err) {
                callback(err);
                return;
            }

            if (domains && domains.length === 1) {
                callback(err, domains[0]);
            }
            else {
                callback({ unknownError: true }, domains);
            }
        });
    },

    /**
     * @name Client.createDomains
     *
     * @description register a new domain in the rackspace domain manager
     *
     * @param {Array}      domains     the array of domains to create
     * @param {Function}   callback    handles the callback of your api call
     */
    createDomains: function(domains, callback) {
        var self = this;

        var listOfDomains = [];
        _.each(domains, function(domain) {
            ['name', 'emailAddress'].forEach(function(required) {
                if (!domain[required]) throw new Error('details.' +
                    required + ' is a required argument.');
            });

            var newDomain = {
                name: domain.name,
                emailAddress: domain.emailAddress
            };

            if (domain.ttl && typeof(domain.ttl) === 'number' && domain.ttl >= 300) {
                newDomain.ttl = domain.ttl;
            }

            if (domain.comment) {
                newDomain.comment = domain.comment;
            }

            listOfDomains.push(newDomain);
        });


        var requestOptions = {
            uri: '/domains',
            method: 'POST',
            data: {
                domains: listOfDomains
            },
            endpoint: rackspace.Endpoints.CloudDns
        };

        self.authorizedRequest(requestOptions, function(err, res, body) {
            if (err || res.statusCode !== 202) {
                callback(err ? err : body);
                return;
            }

            callback(err, new rackspace.Status(self, body));
        });
    },

    createDomainsWithWait: function(domains, callback) {
        var self = this;

        self.createDomains(domains, function(err, status) {

            if (err) {
                callback(err);
                return;
            }

            status.waitForResult(function(err, status) {

                if (err || status.error) {
                    callback(err ? err : status.error);
                    return;
                }

                var newDomains = [];
                if (status.response && status.response.domains) {
                    _.each(status.response.domains, function(domain) {
                        newDomains.push(new rackspace.Domain(self, domain));
                    });
                }

                callback(err, newDomains);
            });
        });
    },

    /**
     * @name Client.importDomain
     *
     * @description This call provisions a new DNS domain under the account
     * specified by the BIND 9 formatted file configuration contents defined
     * in the request object.
     *
     * @param {Object}     details     the information for your new domain
     * @param {Function}   callback    handles the callback of your api call
     */
    importDomain: function(details, callback) {
        var self = this;

        ['contentType', 'contents'].forEach(function(required) {
            if (!details[required]) throw new Error('details.' +
                required + ' is a required argument.');
        });

        if (details.contentType !== 'BIND_9') {
            callback({ invalidRequest: true });
            return;
        }

        var importedDomain = {
            contentType: details.contentType,
            contents: details.contents
        };

        var requestOptions = {
            uri: '/domains/import',
            method: 'POST',
            data: importedDomain,
            endpoint: rackspace.Endpoints.CloudDns
        };

        self.authorizedRequest(requestOptions, function(err, res, body) {
            if (err || res.statusCode !== 202) {
                callback(err);
                return;
            }

            callback(err, new rackspace.Status(self.client, body));
        });
    },

    /**
     * @name Client.updateDomain
     * @description update a domain
     * @param {Domain}      domain      the domain to update
     * @param {Function}    callback    handles the callback of your api call
     */
    updateDomain: function(domain, callback) {
        this.updateDomains([ domain ], callback);
    },

    /**
     * @name Client.updateDomains
     * @description update an array of domains
     * @param {Array}       domains     the array of domains to update
     * @param {Function}    callback    handles the callback of your api call
     */
    updateDomains: function(domains, callback) {
        var self = this;

        var data = [];

        _.each(domains, function(domain) {
            if (!domain.type || !domain.name || !domain.data) {
                return;
            }

            var update = {
                id: domain.id,
                ttl: domain.ttl,
                emailAddress: domain.emailAddress,
                comment: domain.comment
            };

            data.push(update);
        });

        var requestOptions = {
            uri: '/domains/' + self.id,
            method: 'PUT',
            data: {
                domains: data
            },
            endpoint: rackspace.Endpoints.CloudDns
        };

        self.authorizedRequest(requestOptions, function(err, res, body) {
            if (err || res.statusCode !== 202) {
                callback(err);
                return;
            }

            callback(err, new rackspace.Status(self.client, body));
        });
    },

    /**
     * @name Client.deleteDomain
     * @description delete a domain
     * @param {Domain}              domain              the domain to delete
     * @param {Boolean|Function}    deleteSubdomains    remove subdomains? true by default
     * @param {Function}            callback            handles the callback of your api call
     */
    deleteDomain: function(domain, deleteSubdomains, callback) {
        this.deleteDomains([ domain ], deleteSubdomains, callback);
    },

    /**
     * @name Client.deleteDomains
     * @description delete an array of domains
     * @param {Array}               domains             the array of domains to delete
     * @param {Boolean|Function}    deleteSubdomains    remove subdomains? true by default
     * @param {Function}            callback            handles the callback of your api call
     */
    deleteDomains: function(domains, deleteSubdomains, callback) {
        var self = this;

        if (typeof(deleteSubdomains) === 'function') {
            callback = deleteSubdomains;
            deleteSubdomains = true;
        }

        var domainIds = [];

        _.each(domains, function(domain) {
            domainIds.push(domain.id);
        });

        var requestOptions = {
            uri: '/domains/',
            method: 'DELETE',
            qs: {
                id: domainIds,
                deleteSubdomains: deleteSubdomains
            },
            endpoint: rackspace.Endpoints.CloudDns
        };

        self.authorizedRequest(requestOptions, function(err, res, body) {
            if (err || res.statusCode !== 202) {
                callback(err);
                return;
            }

            callback(err, new rackspace.Status(self.client, body));
        });
    }
};