const { EMOJI_STAR, WHITE_EXCLAMATION_MARK } = require('./emoji')

function declOfNum(n, text_forms) {
	n = Math.abs(n) % 100;
	const n1 = n % 10;
	if (n > 10 && n < 20) {
		return text_forms[2];
	}
	if (n1 > 1 && n1 < 5) {
		return text_forms[1];
	}
	if (n1 === 1) {
		return text_forms[0];
	}
	return text_forms[2];
}

module.exports = {
	ru: {
		cbBack: `Назад`,
		cbMenu: `В меню`,
		cbYes: `Да`,
		cbNo: `Нет`,
		cbOk: `Ок`,
		cbAds: `Реклама`,
		cbCost: `Стоимость`,
		cbLimits: `Лимиты`,
		cbLimitFrom: `От`,
		cbLimitTo: `До`,
		cbPin: `Закрепление`,
		cbReject: `Отклонить`,
		cbApprove: `Принять`,
		cbStart: `Начать`,
		cbRefill: `Пополнить`,
		cbInfo: `Инфо`,
		cbConfig: `Управление`,
		cbRepost: `Репост`,
		cbNoLimit: 'Нет лимита',
		cbCreateAds: `Разместить рекламу`,
		cbMyAds: `Моя реклама`,
		cbMyChannels: `Мои каналы`,
		cbFinances: `Финансы`,
		cbSettings: `Настройки`,
		cbLeave: `Оставить`,
		cbTune: `Настроить`,
		cbWithdraw: `Вывести`,
		cbHistory: `История`,
		cbBan: `Забанить`,
		cbUnban: `Разбанить`,
		cbActivate: `Активировать`,
		cbDeactivate: `Деактивировать`,
		cbStop: `Остановить`,
		cbDelete: `Удалить`,
		cbReposts: `Репосты`,
		cbRemove: `Удалить`,
		cbConfirm: `Подтвердить`,
		cbAdd: `Добавить`,
		cbRenew: `Разместить снова`,
		cbChooseTime: `Выбрать время`,
		cbUndo: `Отменить`,
		cbPost: `Разместить`,
		cbAddNew: `Добавить новый`,
		cbInWhiteList: `В белый список`,
		cbWhiteList: `Белый список`,
		cbInBlackList: `В черный список`,
		cbBlackList: `Черный список`,
		cbFeedback: `Обратная связь`,
		cbNeedToPeenPin: `Закреплять`,
		cbDontNeedToPeenPin: `Не закреплять`,
		cbSilent: `Без звука`,
		cbNotSilent: `Со звуком`,
		cbAutoDelete: `Автоудаление`,
		cbHideUrls: `Скрыть ссылки`,
		cbShowUrls: `Показать ссылки`,
		cbTime: `Время`,
		cbSave: `${WHITE_EXCLAMATION_MARK} Сохранить ${WHITE_EXCLAMATION_MARK}`,
		cbButtons: `Кнопки`,
		cbChange: `Изменить`,
		cbPlan: `Планирование`,
		cbManagement: `Управление`,
		cbPostNow: `Разместить сейчас`,
		cbDrafts: `Черновики`,
		cbCreateDraft: `Создать черновик`,
		cbDoNotRemove: `Не удалять`,
		cbDeferred: `Отложка`,
		cbTimezone: `Таймзона`,
		cbToDraft: `В черновики`,
		cbNearestTime: `Ближайшее время`,
		cbPublish: `Опубликовать`,
		infoSuccess: `${EMOJI_STAR} Успешно`,
		no: 'Нет',
		welcomeAds(cost, balance, channel, link) {
			const arr = [
				`Размещение рекламного поста на канале [${channel}](${link})`,
				`Стоимость: \`${cost}\``,
				`Ваш баланс: \`${balance}\``]
			return arr.join('\n')
		},
		welcomeRenew(cost, balance, channel, link) {
			return this.welcomeAds(cost, balance, channel, link)
		},
		welcomeSettings(id) {
			const arr = [
				`Ваш ID: \`${id}\``,
			]
			return arr.join('\n')
		},
		welcomeGroup: [
			'Добавьте бота `{0}` на свой канал с правами:',
			`\t- Отправка сообщений`,
			`\t- Редактирование сообщений`,
			`\t- Добавление пользователей`,
			`Перешлите любой пост из своего канала`,
		].join('\n'),
		welcomePayment: [
			'*ОБЯЗАТЕЛЬНО* укажите комментарий к платежу: `{0}`',
			'Поступления без комментария не обрабатываются',
			'Зачисление происходит в течение 5-ти минут',
		].join('\n'),
		welcomeWithdrawal: [
			`Выберите платежную систему`,
			'Ваш баланс: `{0}`',
			'Платежная система может взимать комиссию. Комиссии со стороны бота нет',
			'Вывод в течение пяти минут'
		].join('\n'),
		withdrawalSumRequest: [
			`Укажите сумму вывода, например:`,
			`\`10.24\``,
			`\`100\``,
			'Ваш баланс: `{0}`'
		].join('\n'),
		welcomeMenu: [
			`Приветствую тебя, \`{0}\`. Я могу:`,
			`\t - Выступать гарантом размещения рекламных постов`,
			`\t - Управлять отложенными постами на твоем канале`,
			'[FAQ]({1})'
		].join('\n'),
		wrongFormat: `Неверный формат`,
		wrongSum: `Неверная сумма`,
		example: 'Пример: `{0}`',
		verifiedMust: 'Кошелек должен быть верифицирован',
		phoneNumber: 'Номер телефона',
		accountYoomoney: 'Номер счета, номер телефона или email',
		withdrawalId: 'Вывод ID: `{0}`',
		postId: 'Пост ID: `{0}`',
		repostId: 'Репост ID: `{0}`',
		groupId: 'Канал ID: `{0}`',
		flowId: 'Флоу ID: `{0}`',
		userId: 'Юзер ID: `{0}`',
		repost: 'Репост: {0}',
		yoCanAssignFiveButtons: 'Вы можете указать до пяти кнопок перехода',
		welcomeDeferred: 'Управление запланированными и размещенными постами',
		postDate: [
			`Время размещения:`,
			`\`{0} ({1})\``
		].join('\n'),
		deleteDate: [
			`Размещен до:`,
			`\`{0} ({1})\``
		].join('\n'),
		postDateQuestion: `Время размещения ({0}). В начале - ближайшие`,
		makePostDeferred(draftMode, prependInfo) {
			const arr = [`Сформируйте или перешлите пост`]
			draftMode && arr.unshift('Создание черновика')
			prependInfo && arr.unshift(prependInfo)
			return arr.join('\n')
		},
		makePost: [
			`Сформируйте или перешлите пост`,
			`Кнопку перехода можно будет создать на следующем этапе`
		].join('\n'),
		buttonQuestion: `Создать кнопку перехода?`,
		hideUrlQuestion: `Скрыть предпросмотр ссылок?`,
		buttonTextQuestion: [
			'Текст на кнопке перехода',
			'Например:',
			`\`Присоединяйся\``,
			`\`Подписаться\``
		].join('\n'),
		buttonUrlQuestion: [`Ссылка на кнопке, например:`, `\`{0}\``, `\`{1}\``, `\`{2}\``].join('\n'),
		wrongPostData: `Пост не распознан`,
		allRight: `Все верно`,
		confirmDate: [
			'Время размещения:',
			`\`{0} ({1})\``,
			'Подтверждаем?'
		].join('\n'),
		confirmDateNearest: [
			'Время размещения:',
			`\`Ближайшее\``,
			'Подтверждаем?'
		].join('\n'),
		withdrawalSum: 'Сумма: `{0}`',
		paymentSuccess: [
			`Поступление средств успешно обработано`,
			'Зачислено: `{0}`',
			'Баланс: `{1}`'
		].join('\n'),
		withdrawalSuccess: `Заявка на вывод успешно обработана`,
		withdrawalError: `Заявка на вывод средств отменена по причине ошибки`,
		postSuccess: `Рекламный пост запланирован`,
		cashBack: `Средства возвращены на баланс`,
		botError: `Внутренняя ошибка`,
		status: 'Статус: `{0}`',
		repostIsProhibited: `Репост запрещен`,
		yesterday: `Вчера`,
		tomorrow: `Завтра`,
		today: `Сегодня`,
		date: `Дата: \`{0} ({1})\``,
		choiceOfPlacementTime: `Выбор времени размещения`,
		choiceOfPlacementDate: `Выберите дату размещения`,
		choiceFreeSlot: `Выберите свободный слот`,
		freeAndOccupiedSlots: `Свободные и занятые слоты`,
		scheduledAndPostedPosts: `Отложенные и размещенные посты`,
		scheduledAndPostedPostsByDay: `Отложенные и размещенные посты по дням`,
		scheduledAndPostedPostsByHour: `Отложенные и размещенные посты по часам`,
		repostIsProhibitedByOwner: `К сожалению, репост запрещен рекламодателем`,
		errorCantRepostByOwner: `Нельзя репостить свои посты`,
		errorNotEnoughMoneyWithdrawal: [
			'Недостаточно средств для вывода',
			'Минимум для выбранной системы: `{0}`',
			'Запрошено: `{1}`'
		].join('\n'),
		errorToManyMoneyWithdrawal: 'Сумма вывода не должна превышать величину баланса',
		errorAdminCantPost: 'Администратор не может размещать рекламу',
		publicationCost: 'Стоимость публикации: `{0}`',
		channelIndex: `Позиция в канале: {0}`,
		reposts: 'Репосты: `{0}`',
		deferred: 'Отложка: `{0}`',
		toBeAgreed: 'На согласовании: `{0}`',
		published: 'Опубликованы: `{0}`',
		awaitingPublication: 'Ожидают публикации: `{0}`',
		successfullyCompleted: 'Успешно завершены: `{0}`',
		canceled: 'Отменены: `{0}`',
		draft: '`Черновик`',
		draftDeferred: 'Черновики: `{0}`',
		waitingDeferred: 'Ожидают: `{0}`',
		postedDeferred: 'Опубликованы: `{0}`',
		isGroupStopped: '`Канал неактивен`',
		other: 'Другое: `{0}`',
		inactive: 'Неактивны: `{0}`',
		views: 'Просмотры: `{0}`',
		spent: 'Затраты: `{0}`',
		errorOnlyOwner: `Действие доступно только рекламодателю`,
		errorOnlyUser: `Действие доступно только администратору канала`,
		errorOnlyAdmin: `Действие доступно только администратору`,
		errorWrongStatus: ['Неверный статус для изменения:', `{0}`].join('\n'),
		errorWrongSum: 'Неверная сумма',
		errorWrongChangesPublished: 'Неподдерживаемые изменения для опубликованного поста',
		errorWrongChangesStatus: ['Неподдерживаемые изменения для статуса', `Статус: \`{0}\``].join('\n'),
		anyMaxCost: 'Нет лимита',
		repostCostStr: 'За какую сумму Вы готовы разместить репост?',
		repostMaxCostStr: 'Максимальная сумма, которую вы готовы заплатить за репост',
		notification(value) {
			const silent = value ? 'Да' : 'Нет'
			return `Без звука: \`${silent}\``
		},
		repostMaxCost(value) {
			const valueStr = value.value ? `До ${value.format()}` : 'Любая'
			return `Оплата за репост: \`${valueStr}\``
		},
		repostMaxCostShort(mode, value) {
			const valueStr = value.value ? `До ${value.format()}` : 'Любая'
			return `Оплата за репост: ` + (!mode ? `\`${valueStr}\`` : `${valueStr}`)
		},
		repostRewardStr: 'Вознаграждение за каждые 1000 подписчиков на канале размещения',
		repostReward: [
			'Вознаграждение за каждые 1000 подписчиков на канале размещения:',
			'`{0}/1000`'
		].join(' '),
		repostRewardShort(mode, value) {
			return `Вознаграждение: ` + (!mode ? `\`${value}/1000\`` : `${value}/1000`)
		},
		repostLimitsStr: 'Лимиты подписчиков на канале размещения',
		repostLimitFromStr: 'Минимальное количество подписчиков на канале размещения',
		repostLimitToStr: 'Максимальное количество подписчиков на канале размещения',
		repostLimit(from, to) {
			const limitFrom = !from ? 'Любой' : `${from}`
			const limitTo = !to ? 'Любой' : `${to}`
			return [
				'Лимит подписчиков на канале размещения:',
				`\t - От: \`${limitFrom}\``,
				`\t - До: \`${limitTo}\``
			].join('\n')
		},
		repostLimitShort(mode, from, to) {
			const limitFrom = !from ? 'Любой' : `${from}`
			const limitTo = !to ? 'Любой' : `${to}`
			return [
				`Лимит подписчиков:`,
				'\t - От: ' + (!mode ? `\`${limitFrom}\`` : `${limitFrom}`),
				'\t - До: ' + (!mode ? `\`${limitTo}\`` : `${limitTo}`)
			].join('\n')
		},
		repostPinStr: 'Необходимо закрепление поста?',
		repostPin(value) {
			const pin = value ? 'Да' : 'Нет'
			return [
				'Закрепление поста:',
				`\`${pin}\``
			].join(' ')
		},
		repostPinShort(mode, value) {
			const pin = value ? 'Да' : 'Нет'
			return `Закрепление поста: ` + (!mode ? `\`${pin}\`` : `${pin}`)
		},
		repostRequirementsStr: 'Требования к каналам',
		channel: `Канал: {0}`,
		pin(value) {
			const pin = value ? 'Да' : 'Нет'
			return `Закрепление поста: \`${pin}\``
		},
		reward: 'Вознаграждение: `{0}`',
		autoDelete: 'Автоудаление: `{0}`',
		paymentMade: `Выплата произведена`,
		paymentNotMade: `Выплата не произведена`,
		fundsAreFrozen: `Средства рекламодателя заморожены`,
		chooseOrType: `Выберите или укажите вручную`,
		lifeTimeQuestion: `Период публикации, часы`,
		timezoneOffsetQuestion: `Смещение Вашей таймзоны относительно UTC в часах`,
		timezoneQuestion: `Выберите таймзону`,
		settingsAreSaved: `Настройки сохранены`,
		reasonCanceledByOwner: `Отменен рекламодателем`,
		reasonCanceledByUser: `Отменен администратором канала`,
		reasonCanceledByAdmin: `Отменен администратором`,
		reasonOwnerOverdue: `Рекламодатель вовремя не подтвердил запрос`,
		reasonUserOverdue: `Администратор канала вовремя не указал время размещения`,
		reasonOwnerReject: `Рекламодатель отклонил запрос в размещении`,
		reasonCantRepost: `Не удалось разместить репост`,
		reasonViolationRepost: `Нарушение условий публикации ({0})`,
		reasonPublicationError: 'Ошибка публикации',
		reasonGroupRemoved: 'Канал не найден',
		reasonGroupStopped: 'Канал остановлен',
		reasonEndPostLifetime: 'Закончился срок размещения',
		reasonForCancellation: [
			`Причина отмены:`,
			'`{0}`'
		].join('\n'),
		reasonForStop: [
			`Причина остановки:`,
			'`{0}`'
		].join('\n'),
		requestLifeTime(value, unit) {
			switch (unit) {
			case 'minutes':
				return `У Вас ${value} ${declOfNum(value, ['минута', 'минут', 'минут'])} на ответ`
			case 'hours':
				return `У Вас ${value} ${declOfNum(value, ['час', 'часа', 'часов'])} на ответ`
			}
		},
		chooseTimeNow: `Теперь Вы можете выбрать время размещения`,
		chooseGroup: `Выберите один из Ваших каналов или добавьте новый`,
		approveRejectNow: `Вы можете принять или отклонить запрос`,
		refills: 'Пополнения: `{0}`',
		forAdvertising: 'На рекламу: `{0}`',
		paymentForReposts: 'Оплата репостов: `{0}`',
		earned: 'Заработано: `{0}`',
		withdrawal: 'Вывод: `{0}`',
		balance: 'Баланс: `{0}`',
		whiteListed: 'В белом списке',
		blackListed: 'В черном списке',
		postAllRight: `Пост выше выглядит правильно?`,
		errorChannelBlackListed: `Канал добавлен в черный лист рекламодателем`,
		postSettingsAllRight: 'Настройки верны?',
		publishQuestion: 'Публикуем?',
		configOrLeave: 'Настроить параметры репоста или оставить по умолчанию?',
		sendFromChannel: 'Перешлите пост из своего канала',
		botIsNotAMember: 'Бот не участник канала',
		channelAdded: 'Канал {0} успешно добавлен',
		choosePaySystem: [
			'Выберите платежную систему',
			`Ваш баланс: \`{0}\``
		].join('\n'),
		chooseDeferredGroup: [
			'Управление отложенными и размещенными постами',
			'Выберите канал'
		].join('\n'),
		chooseGroupsGroup: [
			'Выберите канал или добавьте новый'
		].join('\n'),
		sureStopGroup: 'Вы уверены? Канал перестанет быть доступным для репостов. Все активные репосты будут завершены. Отложенные посты не будут публиковаться',
		sureDeleteGroup: 'Вы уверены? Канал будет удален из списка. Бот покинет Ваш канал. Отложенные посты и черновики будут удалены',
		sureDeactivatePost: 'Вы уверены? Новые репосты будут запрещены',
		sureDeleteDeferred: 'Вы уверены? Удалить?',
		sureStopDeferred: 'Вы уверены? Пост будет удален',
		sureStopPost: 'Вы уверены? Все неопубликованные репосты будут отменены',
		sureDeletePost: 'Вы уверены? Пост будет удален из списка и канала [{0}]({1})',
		sureUndoRepost(isPosted) {
			let append = ' Отменить репост?'
			if (isPosted) {
				append = ' Репост опубликован. Отмена приведет к невыплате вознаграждения'
			}
			return 'Вы уверены?' + append
		},
		sureApproveRepost: 'Вы уверены? Ваши средства на сумму `{0}` будут заморожены',
		sureWhiteList: 'Вы уверены? Запросы на репост из этой группы будут подтверждаться автоматически при наличии достаточного количества средств',
		sureBlackList: 'Вы уверены? Запросы на репост из этой группы будут запрещены',
		sureBan: 'Вы уверены?',
		choosePaymentSystem: 'Вы уверены? Канал будет удален из списка. Бот покинет Ваш канал',
		mediaGroupsNotSupported: 'Медиа группы не поддерживаются, потому что не имеют кнопок',
		setDefaultSettings: 'Здесь Вы можете указать настройки по умолчанию для репостов Вашей рекламы',
		hours(value) {
			return `${value} ${declOfNum(value, ['час', 'часа', 'часов'])}`
		},
		minutes(value) {
			return `${value} ${declOfNum(value, ['минута', 'минуты', 'минут'])}`
		},
		repostConfirmRequest(repostId, channel, cost, pin, lifeTime, lifeTimeUnit) {
			const arr = []
			let _lifetime
			switch (lifeTimeUnit) {
			case 'minutes':
				_lifetime = lifeTime + ' ' + declOfNum(lifeTime, ['минуту', 'минуты', 'минут'])
				break
			case 'hours':
				_lifetime = lifeTime + ' ' + declOfNum(lifeTime, ['час', 'часа', 'часов'])
				break
			}
			arr.push(`Репост ID: \`${repostId}\``)
			arr.push(`Канал: {1}`)
			arr.push(`Ваше вознаграждение: \`${cost}\``)
			arr.push(`После подтверждения рекламодателем, можно будет выбрать время размещения и пост будет опубликован, а затем, через ${_lifetime}, удален автоматически`)
			if (pin) {
				arr.push('Пост будет закреплен')
			}
			arr.push('Запрещается:')
			arr.push('\t- Редактирование поста')
			arr.push('\t- Удаление поста')
			arr.push('\t- Редактирование прав бота или его удаление из канала')
			if (pin) {
				arr.push('\t- Удаление поста из закрепа')
			}
			arr.push('В случае нарушения правил публикации выплата не будет произведена')
			switch (lifeTimeUnit) {
			case 'minutes':
				_lifetime = lifeTime + ' ' + declOfNum(lifeTime, ['минута', 'минуты', 'минут'])
				break
			case 'hours':
				_lifetime = lifeTime + ' ' + declOfNum(lifeTime, ['час', 'часа', 'часов'])
				break
			}
			arr.push(`Вы получите вознаграждение после завершения срока публикации: ${_lifetime}`)
			arr.push(`Отправить запрос рекламодателю?`)
			return arr.join('\n')
		},
		noMoneyApproveRepost: [
			'К сожалению, у Вас недостаточно средств',
			'Необходимо: `{0}`',
			'Подтверждение репоста предполагает заморозку средств рекламодателя',
		].join('\n'),
		refillSystem(system, card) {
			const str = card ? ' картой любого банка или ' : ' '
			return `Пополнение через платежную систему ${system}${str}с баланса кошелька`
		},
		enrollmentAccount: 'Аккаунт зачисления: `{0}`',
		errorUserNotFound: 'Пользватель не найден',
		errorAccessDenied: 'Нет прав для данного действия',
		errorPostNotFound: `Пост не найден`,
		errorRepostNotFound: `Репост не найден`,
		errorGroupNotFound: `Канал не найден`,
		errorSettingsNotFound: 'Настройки не найдены',
		errorDeferredNotFound: 'Пост не найден',
		errorGroupAnotherOwner: 'Группа принадлежит другому администратору',
		errorRenewIndex: 'Пост уже последний в списке на канале [{0}]({1})',
		errorOnlyChannels: 'Размещение возможно только в каналах',
		errorBotRightsAdmin: 'Бот не имеет прав администратора',
		errorBotRightsPost: 'Бот не имеет прав отправки сообщений',
		errorBotRightsEdit: 'Бот не имеет прав редактирования сообщений',
		errorBotRightsInvite: 'Бот не имеет прав приглашения пользователей',
		errorChannelMembersLimit: 'Канал не соотвествует требованию по количеству подписчиков',
		errorRepostCostLimit: 'Запрошенное вознаграждение за репост больше максимального',
		errorUnableGetChannelInfo: 'Невозможно получить информацию о канале',
		errorYouAreBanned: ['Вы забанены, свяжитесь с [администратором]({0})', 'Ваш ID: `{1}`'].join('\n'),
		errorAlreadyBankrupt: 'Уже банкрот',
		feedbackWelcome: [
			'Если Вы столкнулись с любыми трудностями при работе с ботом. Или у Вас есть предложения по улучшению функционала',
			'Пишите [сюда]({0})',
			'Ваш ID: `{1}`'].join('\n'),
		settings: 'Настройки',
		noReposts: `Нет репостов`,
		noPosts: `Нет постов`,
		noDrafts: `Нет черновиков`,
		noChannels: 'Нет каналов',
		noItems: 'Нет записей',
		timezone: ['Временная зона:', '`{0}`'].join('\n'),
		type: 'Тип: `{0}`',
		sum: 'Сумма: `{0}`',
		ownerWillBeSent: `Рекламодателю будет отправлен запрос на размещение поста на Вашем канале. Вы будете проинформированы о результате`,
		youAlreadyHaveRepost: `У вас уже есть активный репост для этого поста`,
		infoWithdrawalRequestCreated: `Заявка на вывод создана`,
		informUser_REPOST_STATUS_50: `Рекламодатель подтвердил размещение {0} на Вашем канале {1}`,
		informUser_REPOST_STATUS_90: `На Вашем канале {0} успешно размещен {1}`,
		informOwner_REPOST_STATUS_90: `На канале {0} успешно размещен Ваш {1}`,
		informOwner_REPOST_STATUS_70(channel, link, isDateModified) {
			const action = isDateModified ? 'изменил время размещения' : 'запланировал размещение'
			return `Владелец канала ${channel} ${action} Вашего ${link}`
		},
		informOwner_REPOST_STATUS_20: `Владелец канала {0} предлагает разместить Ваш {1}`,
		MF_PAYMENT: 'Пополнение',
		MF_RETURN: 'Возврат',
		MF_WITHDRAWAL: 'Вывод',
		MF_POST: 'Оплата рекламы',
		MF_PROFIT: 'Вознаграждение',
		MF_REPOST: 'Оплата репоста',
		MF_UNFREEZE: 'Возврат',
		REPOST_STATUS_0: `Ожидает подтверждения администратором канала`,
		REPOST_STATUS_10: `Ожидает подтверждения рекламодателем`,
		REPOST_STATUS_20: `Ожидает подтверждения рекламодателем`,
		REPOST_STATUS_30: `Отклонен рекламодателем`,
		REPOST_STATUS_40: `Подтвержден рекламодателем`,
		REPOST_STATUS_50: `Отправлен запрос на время размещения`,
		REPOST_STATUS_60: `Ожидает публикации`,
		REPOST_STATUS_70: `Ожидает публикации`,
		REPOST_STATUS_80: `Ожидает публикации`,
		REPOST_STATUS_90: `Опубликован`,
		REPOST_STATUS_100: `Завершается`,
		REPOST_STATUS_110: `Завершен`,
		REPOST_STATUS_120: `Отменяется`,
		REPOST_STATUS_130: `Отменен`,
		GROUP_STATUS_0: 'Активен',
		GROUP_STATUS_10: 'Останавливается',
		GROUP_STATUS_20: 'Остановлен',
		GROUP_STATUS_30: 'Удаляется',
		GROUP_STATUS_40: 'Удаляется',
		GROUP_STATUS_50: 'Канал удален',
		POST_STATUS_0: 'Создан',
		POST_STATUS_10: 'Ожидает публикации',
		POST_STATUS_20: 'Опубликован',
		POST_STATUS_30: 'Ошибка публикации',
		POST_STATUS_40: 'Деактивирован',
		POST_STATUS_50: 'Останавливается',
		POST_STATUS_60: 'Остановлен',
		POST_STATUS_70: 'Удаляется',
		POST_STATUS_80: 'Удаляется',
		POST_STATUS_90: 'Удален',
		DEFERRED_STATUS_0: 'Запланирован',
		DEFERRED_STATUS_10: 'Публикуется',
		DEFERRED_STATUS_20: 'Опубликован',
		DEFERRED_STATUS_30: 'Останавливается',
		DEFERRED_STATUS_40: 'Остановлен',
		DEFERRED_STATUS_50: 'Удален',
		STATUS_UNKNOWN: `{0}`,
	}
}
