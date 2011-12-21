// ------------------------------------------------------------------------------------------------------------- //
// no.Request
// ------------------------------------------------------------------------------------------------------------- //

no.Request = function(groups) {
    this.groups = groups;
    this.promise = new no.Promise();
    this._leftovers = 0;
    this._models_count = 0;
};

// ------------------------------------------------------------------------------------------------------------- //

no.Request.prototype.start = function() {
    var ungrouped = this.ungroup();
    var models = ungrouped.models;

    var leftovers_changed = (this._leftovers - ungrouped.leftovers) !== 0; // Количество моделей, которые мы пока не можем запросить, поменялось.
    var models_number_changed = (this._models_count - models.length) !== 0; // Количество запрашиваемых моделей поменялось.

    // Проверяем, поменялось ли что-то после последнего запроса моделей.
    if (!models_number_changed && !leftovers_changed) {
        this.promise.resolve();
        return this.promise;
    }
    this._leftovers = ungrouped.leftovers;
    this._models_count = models.length;

    var that = this;
    this.requestModels(models).then(function() {
        if (ungrouped.leftovers) { // Если после этого прохода остались незапрошенные данные -- повторяем процедуру.
            that.start(); // processParams вызывается внутри ungroup
        } else {
            that.processParams([]);
            that.promise.resolve();
        }
    });

    return this.promise;
};

// ------------------------------------------------------------------------------------------------------------- //

no.Request.prototype.processParams = function(uncached) {
    var groups = this.groups;
    for (var i = 0, l = groups.length; i < l; i++) {
        var group = groups[i];

        var models = group.models;
        var params = group.params;

        for (var j = 0, m = models.length; j < m; j++) {
            var model_id = models[j];

            var model = no.Model.get( model_id, params );
            if ( model && model.isValid() ) { // Модели, которые уже есть в кэше и валидны - запрашивать не надо.
                model.processParams(params);
            } else {
                uncached.push({
                    model_id: model_id,
                    params: params
                });
            }
        }
    }
}

no.Request.prototype.ungroup = function() {
    var uncached = [];
    this.processParams(uncached);

    var models = [];
    var leftovers = 0;

    for (var i = 0, l = uncached.length; i < l; i++) {
        var item = uncached[i];
        var model_id = item.model_id;

        var model = no.Model.get( model_id, item.params );
        if (!model) {
            model = no.Model.create( model_id, item.params );
            no.Model.set(model);
        }

        var reqParams = model.getReqParams(); // Модель может быть запрошена тогда, когда для её запроса есть всё необходимые параметры.
        if (reqParams) {
            models.push(model);
        } else {
            leftovers++;
        }
    }

    return {
        models: models, // Модели, которые нужно/можно запросить сейчас.
        leftovers: leftovers // То, что по причине отсутствия необходимых параметров, отложено на следующий проход.
    };
};

// ------------------------------------------------------------------------------------------------------------- //

no.Request.prototype.requestModels = function(models) {
    var request = new no.Request.Models(models);
    return request.start();
};

// ------------------------------------------------------------------------------------------------------------- //
// no.Request.Models
// ------------------------------------------------------------------------------------------------------------- //

no.Request.Models = function(models) {
    this.models = models;

    this.promise = new no.Promise();
};

// ------------------------------------------------------------------------------------------------------------- //

no.Request.Models.prototype.start = function() {
    var loading = [];
    var requesting = [];

    var models = this.models;
    for (var i = 0, l = models.length; i < l; i++) {
        var model = models[i];
        var status = model.status;

        if (status === 'ok' || status === 'error') { // Либо все загрузили успешно, либо кончились ретраи.
            // Do nothing.
        } else if (status === 'loading') { // Уже грузится.
            loading.push(model);
        } else {
            // Проверяем, нужно ли (можно ли) запрашивает этот ключ.
            if (status === 'failed') {
                if (!model.canRetry()) {
                    model.status = 'error'; // Превышен лимит перезапросов или же модель говорит, что с такой ошибкой перезапрашиваться не нужно.
                    continue;
                }
            }

            model.retries++;

            model.promise = new no.Promise();
            model.status = 'loading'; // Ключ будет (пере)запрошен.

            requesting.push(model);
        }
    }

    this.request(loading, requesting);

    return this.promise;
};

no.Request.Models.prototype.request = function(loading, requesting) {
    var all = [];

    var l = requesting.length;
    if (l) {
        var params = no.Request.Models.models2params(requesting);
        all.push( no.http('/models/', params) ); // FIXME: Урл к серверной ручке.
    }

    if (loading.length) {
        var promises = no.array.map( loading, function(model) {
            return model.promise;
        });
        all.push( no.Promise.wait(promises) );
    }

    if (all.length) { // Либо нужно запросить какие-то ключи, либо дождаться ответа от предыдущих запросов.
        var that = this;
        no.Promise.wait(all).then(function(r) { // В r должен быть массив из одного или двух элементов.
                                                // Если мы делали http-запрос, то в r[0] должен быть его результат.
            if (l) { // Мы на самом деле делали http-запрос.
                that.extract(requesting, r[0]);
            }
            that.start(); // "Повторяем" запрос. Если какие-то ключи не пришли, они будут перезапрошены.
                          // Если же все получено, то будет выполнен метод done().
        });

    } else {
        this.promise.resolve();
    }
};

no.Request.Models.models2params = function(models) {
    var params = {};

    for (var i = 0, l = models.length; i < l; i++) {
        var suffix = '.' + i; // Чтобы не путать параметры с одинаковыми именами разных моделей,
                              // добавляем к именам параметров специальный суффикс.
        var model = models[i];

        // Каждая модель прокидывает в params все свои параметры (кроме служебных вида _<name>).
        var mParams = model.getReqParams();
        for (var key in model.params) {
            if (!/^_/.test(key)) { // Служебные параметры (начинающиеся на '_') игнорируем.
                params[ key + suffix ] = mParams[key];
            }
        }

        params[ '_model' + suffix ] = model.id;
    }

    return params;
};

no.Request.Models.prototype.extract = function(models, results) {
    var timestamp = +new Date();

    for (var i = 0, l = models.length; i < l; i++) {
        var model = models[i];
        var result = results[i];

        if (!result) {
            model.error = {
                id: 'NO_DATA',
                reason: 'Server returned no data'
            };
            model.status = 'failed';

        } else {
            var data = model.extractData(result);
            if (data) {
                model.data = data;
                model.status = 'ok';
            } else {
                model.error = model.extractError(result);
                model.status = 'failed';
            }
        }
        model.promise.resolve();
    }
};
