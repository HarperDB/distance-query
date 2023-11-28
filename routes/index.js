'use strict';

const geohash = require('ngeohash');
const distance = require('@turf/distance');
const { cell_updated } = databases.networkinsights;

module.exports = async (server) => {
  // GET cities by distance
  server.route({
    url: '/distance/',
    method: 'GET',
    handler: async (request, reply) => {
      //get lat & long from request params
      let lat = request.query.lat;
      let long = request.query.long;

      //long_lat will be used in the distance function
      const long_lat = [long, lat];
      //create geohash bounding box for lat / long, precision of 4 which is a bounding box of 39.1km	×	19.5km, with the neighbors included this will allow a search to get everything in a 40 km distance.
      let hash = geohash.encode(lat, long, 4);
      //get the neighboring bounding boxes
      let neighbors = geohash.neighbors(hash);
      //add the hash bouding box to neighbors, so we are searching the entire area
      neighbors.push(hash);

      //execute starts_with search on all hashes
      let search_results = await cell_updated.search({
        conditions: neighbors.map((value) => ({
          attribute: 'geo_hash',
          comparator: 'starts_with',
          value,
        })),
        operator: 'or',
      });

      let results = [];
      for await  (const entry of search_results){
        const point = [entry.longitude, entry.latitude];

        //calculate distance between points in miles
        let dist = distance.default(long_lat,point, {units:'miles'});

        //if distance is less than 24.8548 miles (40 km) we add it to the results
        if(dist < 24.8548) {
          //set the distance attribute on the entry
          entry.distance = dist;
          results.push(entry);
        }
      }

      //sort the results based on distance ASC
      return results.sort((a, b) => a.distance - b.distance);
    }
  });

};
