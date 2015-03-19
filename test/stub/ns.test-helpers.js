/**
 * Helpers for unit testing
 * @namespace
 */
ns.test = {};

/**
 * Включает автоответ валидными моделями
 * @param {sinon.sandbox} sinon
 */
ns.test.modelsValidAutorespond = function(sinon) {
    sinon.server.autoRespond = true;
    sinon.server.respond(function(xhr) {
        console.log('modelsValidAutorespond', xhr.url);
        xhr.respond(
            200,
            {"Content-Type": "application/json"},
            JSON.stringify({
                models: [
                    { data: true }
                ]
            })
        );
    });
};

ns.test.modelsValidAutorespondByMock = function(sinon, mock) {
    sinon.server.autoRespond = true;
    sinon.server.respond(function(xhr) {
        console.log('modelsValidAutorespondByMock', xhr.url);
        if (!(xhr.url in mock)) {
            throw new Error('No mock defined for ' + xhr.url);
        }
        xhr.respond(
            200,
            {"Content-Type": "application/json"},
            JSON.stringify(mock[xhr.url])
        );
    });
};
