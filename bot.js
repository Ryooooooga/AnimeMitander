!function() {
	try {
		//	ライブラリのロード
		const fs	= require('fs');
		const twit	= require('twit');

		//	キーのロード
		const keys	= require('./keys.js');

		//	初期化
		const tw = new twit(keys);

		//	アカウント名
		const accountName = '@AnimeMitander';

		//	権限
		const permissions = {
			none	: 1,
			freezed	: 2,
			user	: 3,
			admin	: 4,
		};

		const maxAnimeNameLength = 50;


		/**
		 * Jsonファイルの読み込み
		 * @param  string path 読み込むファイルのパス
		 * @return object      読み込んだデータ
		 */
		const readJson = function(path) {
			console.log('readJson @path:' + path);
			try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
			catch(e) { console.log(e); }
		};

		/**
		 * Jsonファイルの書き込み
		 * @param string path 書き込むファイルへのパス
		 * @param object data 書き込むデータ
		 */
		const writeJson = function(path, data) {
			console.log('writeJson @path:' + path);
			var str = JSON.stringify(data, null, '\t');
			fs.writeFile(path, str);
		};

		/**
		 * ツイートのポスト
		 * @param  string   str      ポストするツイート
		 * @param [string   to       リプライするツイートID]
		 * @param [function callback コールバック関数]
		 */
		const post = function(str, to, callback) {
			console.log('post:to-'+to+'\n'+str);
			tw.post('statuses/update', { status : str, in_reply_to_status_id : to }, callback ? callback : function() {});
		};

		/**
		 * ツイートの分割ポスト
		 * @param  string   phrase   各メッセージの前に付く定型文
		 * @param  object   msgs     メッセージ配列
		 * @param  string   to       リプライするツイートID
		 * @param [fucntion callback 各メッセージごとに呼ばれるコールバック メッセージを返す]
		 *
		 * ツイートが長すぎれば分割ツイートする
		 */
		const postDiv = function(phrase, msgs, to, callback) {
			var str = phrase;
			for(var msg in msgs) {
				var s   = callback ? callback(msg) : msg;
				if(!s) { continue; }
				s = '\n'+s;

				var buf = str+s;
				if(buf.length > 140) {
					post(str, to);
					str = phrase+s;
				}
				else {
					str = buf;
				}
			}

			post(str, to);
		};

		//	コマンド
		const commands = {
			//	終了
			stop: {
				permission: permissions.admin,
				comment: "stop : 終了",
				callback: function(tweet, user, params) {
					post('.@'+tweet.user.screen_name+' 終了するよっ', undefined, function() {
						process.exit();
					});
				}
			},

			//	エコー
			echo: {
				permission: permissions.admin,
				comment: "$msg echo : エコー",
				callback: function(tweet, user, params) {
					if(params.length != 1) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.echo.comment, tweet.id_str);
						return;
					}

					post('@'+tweet.user.screen_name+' >echo "'+params[0]+'"', tweet.id_str);
				}
			},

			//	ヘルプ
			help: {
				permission: permissions.none,
				comment: "[$command] help : ヘルプの表示",
				callback: function(tweet, user, params) {
					if(params.length == 0) {
						//	コマンドの列挙
						postDiv('@'+tweet.user.screen_name, commands, tweet.id_str, function(msg) {
							var cmd = commands[msg];
							return (cmd.permission > user.permission) ? null : (msg+' [ '+commands[msg].comment+' ] ');
						});
					}
					else if(params.length == 1) {
						//	コマンドの説明
						var msg = commands.hasOwnProperty(params[0]) ? commands[params[0]].comment : '不明なコマンドだよぉ……';
						post('@'+tweet.user.screen_name+' '+msg, tweet.id_str);
					}
					else if(params.length > 2) {
						//	パラメータ多すぎ
						post('@'+tweet.user.screen_name+' パラメータが多すぎるよぉ……\n'+commands.help.comment, tweet.id_str);
						return;
					}
				}
			},

			//	ユーザーの追加
			addUser: {
				permission: permissions.admin,
				comment: "$userName addUser : ユーザーの追加",
				callback: function(tweet, user, params) {
					if(params.length != 1) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.addUser.comment, tweet.id_str);
						return;
					}

					var userNameToAdd	= params[0];
					var userFilePath	= userNameToAdd+'.json';

					//	もういる
					if(readJson(userFilePath)) {
						post('@'+tweet.user.screen_name+' その人もういるよぉ……', tweet.id_str);
						return;
					}

					//	ユーザーファイルの作成
					writeJson(
						userFilePath,
						{
							permission: permissions.user,
							anime: {},
							alias: {},
						}
					);

					post('@'+tweet.user.screen_name+' ユーザー['+params[0]+']を追加したよっ', tweet.id_str);
				}
			},

			//	パーミッションの設定
			setPermission: {
				permission: permissions.admin,
				comment: "$userName $permission setPermission : 権限の設定",
				callback: function(tweet, user, params) {
					if(params.length != 2) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.setPermission.comment, tweet.id_str);
						return;
					}

					var userName		= params[0];
					var userFilePath	= userName+'.json';
					var userToModify	= readJson(userFilePath);
					var permission		= permissions[params[1]];

					if(!userToModify) {
						post('@'+tweet.user.screen_name+' そんなユーザーいないよぉ……', tweet.id_str);
						return;
					}
					if(!permission) {
						post('@'+tweet.user.screen_name+' 権限が間違ってるよぉ……', tweet.id_str);
						return;
					}

					//	変更を保存
					userToModify.permission = permission;
					writeJson(userFilePath, userToModify);

					post('@'+tweet.user.screen_name+' ['+userName+']の権限を['+params[1]+']に設定したよっ', tweet.id_str);
				},
			},

			//	ユーザー削除
			deleteMe: {
				permission: permissions.normal,
				comment: '$yourName deleteMe : あなたのユーザーデータの削除',
				callback: function(tweet, user, params) {
					if(params.length != 1 || params[0] != tweet.user.screen_name) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.deleteMe.comment, tweet.id_str);
						return;
					}

					fs.unlinkSync(params[0]+'.json');
					post('@'+tweet.user.screen_name+' あなたのデータを削除したよっ', tweet.id_str);
				}
			},

			//	アニメの追加
			addAnime: {
				permission: permissions.normal,
				comment: '$title addAnime : アニメの追加',
				callback: function(tweet, user, params) {
					var replyTo = '@'+tweet.user.screen_name+' ';
					if(params.length != 1) {
						post(replyTo+'パラメータがおかしいよぉ……\n'+commands.addAnime.comment, tweet.id_str);
						return;
					}

					//	タイトルチェック
					var title = params[0];
					if(user.anime.hasOwnProperty(title) || user.alias.hasOwnProperty(title)) {
						post(replyTo+'もう見てるよぉ……', tweet.id_str);
						return;
					}
					else if(commands.hasOwnProperty(title)) {
						post(replyTo+'ごめんね、その名前は使えないの……', tweet.id_str);
						return;
					}
					else if(title.length > maxAnimeNameLength) {
						post(replyTo+'名前が長すぎるよぉ……', tweet.id_str);
						return;
					}

					user.anime[title] = { seen: 0, begin: new Date() };

					writeJson(tweet.user.screen_name+'.json', user);
					post('@'+tweet.user.screen_name+' '+title+' の視聴を開始したよっ', tweet.id_str);
				}
			},

			//	アニメの削除
			removeAnime: {
				permission: permissions.normal,
				comment: '$title removeAnime : アニメの視聴を中止する',
				callback: function(tweet, user, params) {
					var replyTo = '@'+tweet.user.screen_name+' ';
					if(params.length != 1) {
						post(replyTo+'パラメータがおかしいよぉ……\n'+commands.removeAnime.comment, tweet.id_str);
						return;
					}

					//	タイトルチェック
					var title = params[0];
					if(!user.anime.hasOwnProperty(title)) {
						post(replyTo+'そんなアニメないよぉ……', tweet.id_str);
						return;
					}

					delete user.anime[title];

					//	エイリアスのチェック
					for(var name in user.alias) {
						if(user.alias[name] == title) {
							delete user.alias[name];
						}
					}

					writeJson(tweet.user.screen_name+'.json', user);
					post('@'+tweet.user.screen_name+' '+params[0]+' の視聴を中止したよっ', tweet.id_str);
				}
			},

			//	視聴の完了
			endAnime: {
				permission: permissions.normal,
				comment: '$title endAnime : アニメを見終わった',
				callback: function(tweet, user, params) {
					var replyTo = '@'+tweet.user.screen_name+' ';
					if(params.length != 1) {
						post(replyTo+'パラメータがおかしいよぉ……\n'+commands.removeAnime.comment, tweet.id_str);
						return;
					}

					//	タイトルチェック
					var title = params[0];
					if(!user.anime.hasOwnProperty(title)) {
						if(!user.alias.hasOwnProperty(title)) {
							post(replyTo+'そんなアニメないよぉ……', tweet.id_str);
							return;
						}
						title = user.alias[title];
					}

					if(user.anime[title].end) {
						post(replyTo+'それもう見終わってるよぉ……', tweet.id_str);
						return;
					}

					user.anime[title].end = new Date();

					writeJson(tweet.user.screen_name+'.json', user);
					post('@'+tweet.user.screen_name+' '+title+' を '+user.anime[title].seen+'話で見終わったよっ', tweet.id_str);
				}
			},

			//	見た
			saw: {
				permission: permissions.normal,
				comment: '$title [$number] [完] 見た : アニメを見た',
				callback: function(tweet, user, params) {
					var replyTo = '@'+tweet.user.screen_name+' ';

					//	パラメータチェック
					if(params.length == 0 || (params.length == 3 && params[2] != '完') || params.length > 3) {
						post(replyTo+'パラメータがおかしいよぉ……\n'+commands.saw.comment, tweet.id_str);
						return;
					}

					//	タイトルチェック
					var title = params[0];
					if(!user.anime.hasOwnProperty(title) && !user.alias.hasOwnProperty(title)) {
						post(replyTo+'そんなアニメないよぉ……', tweet.id_str);
						return;
					}

					//	アニメ名の取得
					var animeName = user.alias.hasOwnProperty(title) ? user.alias[title] : title;

					//	見終わってる?
					if(user.anime[animeName].end) {
						post(replyTo+'それもう見終わってるよぉ……', tweet.id_str);
						return;
					}

					//	完?
					var isEnd = params[params.length-1] == '完';
					if(isEnd) { params = params.slice(0, -1); }

					//	話数
					var story = params.length == 2 ? params[1]-0 : 0|user.anime[animeName].seen+1;
					if(story <= 0 || isNaN(story)) {
						post(replyTo+'話数がおかしいよぉ……', tweet.id_str);
						return;
					}

					//	見たことにする
					user.anime[animeName].seen = story;
					user.anime[animeName].last = new Date();

					//	完?
					if(isEnd) {
						user.anime[animeName].end = user.anime[animeName].last;
					}

					writeJson(tweet.user.screen_name+'.json', user);
					post(replyTo+animeName+' '+story+(isEnd ? '話で見終わったよっ' : '話を見たよっ'), tweet.id_str);
				}
			},

			//	リスト
			listAnime: {
				permission: permissions.normal,
				comment: 'listAnime : 視聴中のアニメの列挙',
				callback: function(tweet, user, params) {
					//	パラメータチェック
					if(params.length > 0) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.listAnime.comment, tweet.id_str);
						return;
					}

					postDiv('@'+tweet.user.screen_name+' 今見てるアニメだよっ', user.anime, tweet.id_str, function(title) {
						if(user.anime[title].end) { return; }
						return title+' '+(user.anime[title].seen == 0 ? '未視聴' : user.anime[title].seen+'話');
					});
				}
			},

			//	終了アニメ	TODO:期間区切りとか
			listAnimeEnd: {
				permission: permissions.normal,
				comment: 'listAnimeEnd : 見終わったアニメの列挙',
				callback: function(tweet, user, params) {
					//	パラメータチェック
					if(params.length > 0) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.listAnimeEnd.comment, tweet.id_str);
						return;
					}

					postDiv('@'+tweet.user.screen_name+' 見終わったアニメだよっ', user.anime, tweet.id_str, function(title) {
						if(!user.anime[title].end) { return; }
						return title;
					});
				}
			},

			//	まだ見てないアニメ
			notYet: {
				permission: permissions.normal,
				comment: 'notYet : 前回の視聴から1週間以上経過したアニメの一覧',
				callback: function(tweet, user, params) {
					//	パラメータチェック
					if(params.length > 0) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.notYet.comment, tweet.id_str);
						return;
					}

					postDiv('@'+tweet.user.screen_name+' まだ見てないアニメだよっ', user.anime, tweet.id_str, function(title) {
						if(user.anime[title].end) { return; }	//	既に見終わってる

						//	経過時間
						const now	= new Date();
						const last	= new Date(user.anime[title].last);

						if(last && (now.getTime() - last.getTime())/1000/60/60/24 < 7) {
							return;
						}

						return title+' '+(0|user.anime[title].seen+1)+'話';
					});
				}
			},

			//	アニメの数
			numAnime: {
				permission: permissions.normal,
				comment: 'numAnime : 視聴中のアニメの本数',
				callback: function(tweet, user, params) {
					if(params.length > 0) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.listAnime.comment, tweet.id_str);
						return;
					}

					var n = 0;
					for(var title in user.anime) {
						n += !user.anime[title].end;
					}

					post('@'+tweet.user.screen_name+' 今見てるのは'+n+'本だよっ', tweet.id_str);
				}
			},

			//	エイリアス追加
			addAlias: {
				permission: permissions.normal,
				comment: '$alias $title addAlias : アニメに別名をつける',
				callback: function(tweet, user, params) {
					var replyTo = '@'+tweet.user.screen_name+' ';
					if(params.length != 2) {
						post(replyTo+'パラメータがおかしいよぉ……\n'+commands.addAlias.comment, tweet.id_str);
						return;
					}

					var alias = params[0];
					var title = params[1];

					if(!user.anime.hasOwnProperty(title)) {
						post(replyTo+'そんなアニメないよぉ……', tweet.id_str);
						return;
					}

					if(user.alias.hasOwnProperty(alias) || user.anime.hasOwnProperty(alias)) {
						post(replyTo+'もうその名前は登録されてるよぉ……', tweet.id_str);
						return;
					}

					if(commands.hasOwnProperty(alias)) {
						post(replyTo+'ごめんね、その名前は使えないの……', tweet.id_str);
						return;
					}

					if(alias.length > maxAnimeNameLength) {
						post(replyTo+'名前が長すぎるよぉ……', tweet.id_str);
						return;
					}

					user.alias[alias] = title;
					post(replyTo+alias+' を '+title+' の別名に登録したよっ', tweet.id_str);
					writeJson(tweet.user.screen_name+'.json', user);
				}
			},

			//	エイリアスの削除
			removeAlias: {
				permission: permissions.normal,
				comment: '$alias removeAlias : 別名の削除',
				callback: function(tweet, user, params) {
					var replyTo = '@'+tweet.user.screen_name+' ';
					if(params.length != 1) {
						post(replyTo+'パラメータがおかしいよぉ……\n'+commands.removeAlias.comment, tweet.id_str);
						return;
					}

					var alias = params[0];
					if(user.alias.hasOwnProperty(alias)) {
						var title = user.alias[alias];
						delete user.alias[alias];
						post(replyTo+title+' の別名 '+alias+' を削除したよっ', tweet.id_str);
						writeJson(tweet.user.screen_name+'.json', user);
					}
					else {
						post(replyTo+'そんな別名ないよぉ……', tweet.id_str);
					}
				}
			},

			//	エイリアスのリスト
			listAlias: {
				permission: permissions.normal,
				comment: 'listAlias : 別名の列挙',
				callback: function(tweet, user, params) {
					//	パラメータチェック
					if(params.length > 0) {
						post('@'+tweet.user.screen_name+' パラメータがおかしいよぉ……\n'+commands.listAnime.comment, tweet.id_str);
						return;
					}

					postDiv('@'+tweet.user.screen_name, user.alias, tweet.id_str, function(alias) {
						return alias+' = '+user.alias[alias];
					});
				}
			},
		};
		commands['視聴開始'		] = commands.addAnime;
		commands['視聴中止'		] = commands.removeAnime;
		commands['切り'			] = commands.removeAnime;
		commands['視聴完了'		] = commands.endAnime;
		commands['見た'			] = commands.saw;
		commands['見てるの'		] = commands.listAnime;
		commands['今見てるの'		] = commands.listAnime;
		commands['見終わったの'		] = commands.listAnimeEnd;
		commands['まだ見てないの'	] = commands.notYet;
		commands['本数'			] = commands.numAnime;


		//	ストリームの監視
		post('起動したよっ');
		tw.stream('statuses/filter', { track: accountName }).on('tweet', function(tweet) {
			console.log(
				'@'+tweet.user.screen_name+'\n'+
				tweet.text
			);

			//	区切り文字の置換
			var pos		= tweet.text.indexOf(accountName);
			var params	= tweet.text
								.slice(pos+accountName.length)
								.replace(/[\s　]+/g, ' ')
								.replace(/^[\s　]+|[\s　]+$/g, '')
								.split(' ');

			//	コマンドの切り出し
			if(params.length == 0) { return; }
			var cmdName = params[params.length-1];
			params = params.slice(0, -1);

			if(!commands.hasOwnProperty(cmdName)) { return; }
			var cmd = commands[cmdName];

			//	ユーザーデータの読み込み
			var user = readJson(tweet.user.screen_name+'.json');
			if(!user) { return; }

			//	権限のチェック
			if(user.permission < cmd.permission) {
				post('@'+tweet.user.screen_name+' 実行する権限がないよぉ……', tweet.id_str);
				return;
			}

			//	コマンドの実行
			commands[cmdName].callback(tweet, user, params);
		});
	}
	catch(e) {
		console.log(e);
	}
}();
