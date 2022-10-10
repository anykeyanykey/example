module.exports = Object.freeze({
	REPOST_STATUS_0: 0, // создан
	REPOST_STATUS_10: 10, // подтвержен пользователем
	REPOST_STATUS_20: 20, // отправлен запрос овнеру
	REPOST_STATUS_30: 30, // rejected
	REPOST_STATUS_40: 40, // approved
	REPOST_STATUS_50: 50, // отправлен запрос на время
	REPOST_STATUS_60: 60, // время задано
	REPOST_STATUS_70: 70, // ожидает публикации
	REPOST_STATUS_80: 80, // публикуется
	REPOST_STATUS_90: 90, // опубликовано
	REPOST_STATUS_100: 100, // запрос на завершение
	REPOST_STATUS_110: 110, // завершен
	REPOST_STATUS_120: 120, // запрос на отмену
	REPOST_STATUS_130: 130, // отменен

	REPOST_KNOWN_STATUSES: Object.freeze([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]),

	GROUP_STATUS_0: 0, // создана
	GROUP_STATUS_10: 10, // запрос на стоп
	GROUP_STATUS_20: 20, // остановлена
	GROUP_STATUS_30: 30, // запрос на leave
	GROUP_STATUS_40: 40, // запрос на удаление
	GROUP_STATUS_50: 50, // удалена

	GROUP_KNOWN_STATUSES: Object.freeze([0, 10, 20, 30, 40, 50]),

	POST_STATUS_0: 0, // создан
	POST_STATUS_10: 10, // запрос на публикацию
	POST_STATUS_20: 20, // опубликован
	POST_STATUS_30: 30, // ошибка публикации
	POST_STATUS_40: 40, // деактивирован
	POST_STATUS_50: 50, // запрос на стоп
	POST_STATUS_60: 60, // остановлен
	POST_STATUS_70: 70, // запрос на удаление из канала
	POST_STATUS_80: 80, // запрос на удаление
	POST_STATUS_90: 90, // удален

	POST_KNOWN_STATUSES: Object.freeze([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]),

	DEFERRED_STATUS_0: 0, // запланирован
	DEFERRED_STATUS_10: 10, // публикуется
	DEFERRED_STATUS_20: 20, // опубликован
	DEFERRED_STATUS_30: 30, // запрос на стоп
	DEFERRED_STATUS_40: 40, // остановлен
	DEFERRED_STATUS_50: 50, // удален

	DEFERRED_KNOWN_STATUSES: Object.freeze([0, 10, 20, 30, 40, 50]),
})
