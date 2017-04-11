/*eslint-env node */
var express = require("express");
var emoji = require("node-emoji").emoji;
var request = require("request");
var bodyParser = require("body-parser");
var watson = require( "watson-developer-cloud" ); 

var workspaceIdVP="adfd70ec-5e74-4a2e-a7f9-2202a29f2828";
var session = require("cookie-session");
var path = require("path");

var secret = "AlainSecretpageAccessToken";

var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyBmkiXqLLAmnRnFB7bBr4PENDaZ0e-RMFU'
});

var pageAccessToken="EAAFCTy00UEQBAJNsqPTYzsHYYSXnLvm0cbN196HowkRdBhRU9gi6ZCYUhGutEMAtfZBEFWCzyRWEf0TcHWzKaXBU2YcjistVMuTE1fgDlMPQeoukedmtbSairZACKqDvv57tioWz4CZCoZABAeWz4fjfpKwdXfbgpOIzqZCwAJnQZDZD";


// Facebook payloads
var CallAction = "CALL";
var ContinueWatson = "WATS";


var conversation = watson.conversation( {
  url: "https://gateway.watsonplatform.net/conversation/api",
  password: "gMzq0zzYoeKz",
  username: "856422da-2f4c-4eb4-b03f-2a1d3c73531d",
  version_date: "2016-07-11",
  version: "v1"
} );

var visual_recognition = watson.visual_recognition({
  api_key: "10f176c7bfad6c88a71e1cbe0897feff8de7cb65",
  version: "v3",
  version_date: "2016-05-20"
});

// file is included here:

var app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
/* On utilise les contexts */
app.use(session({secret: "flashinfosecret"}));


var contexts;

//Watson part
// Endpoint to be call from the client side
app.post( "/api/message", function() {

} );

//assuming app is express Object.
app.get("/license",function(res){
     res.sendFile("license.html");
});

//Facebook part
// This code is called only when subscribing the webhook //
app.get("/webhook/", function (req, res) {
    if (req.query["hub.verify_token"] === secret) {
        res.send(req.query["hub.challenge"]);
    }
    res.send("Error, wrong validation pageAccessToken");
});

// Incoming messages reach this end point //
app.post("/webhook/", function (req, res) {

    var url;
    var messaging_events, messageData;
    var sender, event, i;
    var  conversationContext = findOrCreateContext(sender);
   
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
        conversationContext = findOrCreateContext(sender);
        
        ///
        ///   Cas 1 : Message utilisateur
        ///
        if (event.message && event.message.text) {
					console.log("event.message.text : " + event.message.text);
				analyzeTone (sender, event.message.text);
        }
        ///
        ///   Cas 2 : Postback Messenger
        ///
        else if (event.postback) {
        	switch (event.postback.payload) {
            		
        		default:
        			//Get the name
        			url =  "https://graph.facebook.com/v2.6/"+sender+"?fields=first_name&access_token="+pageAccessToken;
					request(url, function (err, response, body) {
				       if (!err && response.statusCode === 200) {
					        conversationContext.name = JSON.parse (body).first_name;
					        console.log ("so ok"+conversationContext.name);
                			messageData = {
        				text: "Bonjour "+ conversationContext.name + ", je m'appelle Watson The Diver, je suis spécialiste autour de la plongée. Comment puis-je vous aider ? \n\nPour connaitre mes domaines d'expertise, taper Aide"
    				};
	        				sendFBMessage (sender, messageData);
					    }
					    else{
							console.log("error facebook in the beginning "+ err);
							messageData = {text: emoji.no_entry_sign+"Erreur technique : Veuillez renouveler votre demande.Merci"};
							sendFBMessage (sender, messageData);
					    }		    
					});
				break;
	        	}
      }
			else if (event.message && event.message.attachments && event.message.attachments[0].type === "location") {

				var latlng_value = event.message.attachments[0].payload.coordinates.lat+","+event.message.attachments[0].payload.coordinates.long;
				googleMapsClient.reverseGeocode({
						latlng: latlng_value
				}, function(err, response) {
					if (!err) {
							console.log("Coordonnées : " + response.json.results[1].formatted_address);
							console.log("Coordonnées : " + response.json.results[2].address_components[0].long_name);
							var code_postal = response.json.results[2].address_components[0].long_name;
							var ville = response.json.results[1].formatted_address;
							var dep = code_postal.substring(0, 2);
							console.log("dep : " + dep);
							if (dep === "92" || dep === "75" || dep === "95" || dep === "56")
							{
								var txt = " Près de " + ville +", je vois 3 sites de plongées intéressants : \n - Fosse Aqua92 \n - Fosse Conflans St Honorine \n - Lac de Beaumont sur Oise" 
								messageData  = {text: txt};
							}
							else{
								messageData  = {text: "Je vois 3 sites de plongées intéressants : \n - Fosse Aqua92 \n - Fosse Conflans St Honorine \n - Lac de Beaumont sur Oise" };
							}

							sendFBMessage (sender, messageData);
					}
				});
			}
  	  ///
      ///   Cas 4 : Message utilisateur de type image
      ///
      else if (event.message && event.message.attachments && event.message.attachments[0].type === "image") {
      		var params = {
  				url: event.message.attachments[0].payload.url,
  				classifier_ids: ["docbancaires_1809107749"] 
				};
      		visual_recognition.classify(params, function(err, res) {
				  if (err)
				    messageData = {text: emoji.frame_with_picture+" Processus de reconnaissance d'image : désolé...erreur technique "};
				  else 
				  	if (res.images[0].classifiers.length && res.images[0].classifiers[0].classes.length && res.images[0].classifiers[0].classes[0].class)
					    messageData = {text: emoji.frame_with_picture+" Processus de reconnaissance d'image - document bien identifié: "+res.images[0].classifiers[0].classes[0].class};
					else
						messageData  = {text: emoji.frame_with_picture+" Image non identifiée"};
				
				  sendFBMessage (sender, messageData);
			      
});
   	 }
  		
    }
    res.sendStatus(200);
});


// This function receives the response data to FB  //
function sendFBMessage(sender,messageData) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: pageAccessToken},
        method: "POST",
        json: {
            recipient: {id: sender},
            message: messageData,
        }      
    }, function (error, response) {
        if (error) {
            console.log("Error sending message: ", error + messageData) ;
        } else if (response.body.error) {	
            console.log("Error sec: ", response.body.error + messageData);
           request({
		        url: "https://graph.facebook.com/v2.6/me/messages",
		        qs: {access_token: pageAccessToken},
		        method: "POST",
		        json: {
		            recipient: {id: sender},
		            message: {text: emoji.no_entry_sign+"Désolé nous sommes confrontés à un problème technique.Merci de votre compréhension"},
		        		}  
		    }, function (error, response) {
		        if (error) {
		            console.log("Error sending message twice: ", error);
			        } else if (response.body.error) {
			            console.log("Error third: ", response.body.error);
			       }
			 });
          }
    });
}

function analyzeTone (sender, inputText) {
      var messageData;
      var params = {
      		text : inputText,
      		language : "french"
      	};
      var  conversationContext = findOrCreateContext(sender);
	  converseText (sender, inputText); 
     /* alchemy_language.sentiment(params, function (err, response) {
    	if (err) {
    	}
   		else {
     		 if (response.docSentiment.type === "negative" && response.docSentiment.score < -0.9)	{
	     			conversationContext.inputText = inputText;
	     			// The user is mad shall we call a person
	     			messageData = {
	     				text : "La situation semble tendue...."
	     			};
					sendFBMessage (sender, messageData);
	     		}
	     	//	if (response.docSentiment.type === "positive" && response.docSentiment.score > 0.93) {
	     	//		messageData = {
	     	//			text : emoji.thumbsup + "Nous apprécions la joie que nous ressentons dans votre message."
	     	//		};
	     	//		sendFBMessage (sender, messageData);
	     	//	}
		     // Call Conversation that will then return message to Facebook 
		     
    	}
 	  });*/
}


function converseText (sender, inputText) {
		var payloadToWatson = {};
		var messageData;
		var dataText="";
	    var conversationContext = findOrCreateContext(sender);		    	
	    payloadToWatson.input = {
	        text: inputText
	    };
	  	payloadToWatson.workspace_id = conversationContext.workspaceId;
	     if (!conversationContext) conversationContext = {};
	    payloadToWatson.context = conversationContext.watsonContext;
			//console.dir("payloadToWatson : " + payloadToWatson.context);
	    conversation.message( payloadToWatson, function(err, response) {
	    	if (err)
    			console.log("error:", err);
    		else {
					console.log("Detected " + JSON.stringify(response, null, 4));
					console.log('Detected intent: #' + response.intents[0].intent);
					if(response.entities[0]) console.log('Detected Entity: #' + response.entities[0].entity);
					 conversationContext.watsonContext = response.context;
    			// traitements spécifiques ou pas en fonction de la réponse de Watson Conversation
    			/*if (response.intents[0].intent==="localisation")
						{

							googleMapsClient.geocode({
								address: 'Giens, FR'
							}, function(err, response) {
								if (!err) {
								// console.log(JSON.stringify(response.json.results,null,4));
									console.log("Coordonnées : " + JSON.stringify(response.json.results[0].geometry.location,null,4));
									var lat = response.json.results[0].geometry.location.lat;
									var lng = response.json.results[0].geometry.location.lng;
									var url =  "http://api.divesites.com/?mode=sites&lat="+lat+"&lng="+lng+"&dist=25"; 
							console.log(url);
												request(url, function (err, response, body) {
														if (!err && response.statusCode === 200) {
																			var result = JSON.parse(body);
																			console.log(JSON.stringify(result.sites,null,4));
																			console.log("Size " + result.sites.length);
																			console.log("Il y a "+result.sites.length+" sites autour de ce lieu.")
																			
																		}
														else{
														console.log("error Dives Sites "+ err);
														
														}		    
												});
									}
							});

						}
					else  */
					if (response.entities[0]) {
						if (response.entities[0].value === "cursus") {
						messageData = {
								"attachment":{
									"type":"image",
									"payload":{
										"url":"http://www2.padi.com/scuba/uploadedImages/Padi_Courses/getimage.jpg"
									}
								}
							};
						sendFBMessage (sender, {text:response.output.text[0]});
						sendFBMessage (sender, messageData);
					}
					else if (response.entities[0].entity === "réponses")
					{
						messageData = {
								"attachment":{
									"type":"template",
									"payload":{
										"template_type":"button",
										"text":emoji.phone + "Vous désirez discuter avec nous tout de suite ?",
											"buttons":[
												{
														"type":"phone_number",
														"title":"Oui",
														"payload":"+33660590515"
												},
											{
												"type":"postback",
												"title":"Non",
												"payload": ContinueWatson
											}
										]
									}
								}
							};
						sendFBMessage (sender, {text:response.output.text[0]});
						sendFBMessage (sender, messageData);
					}
					else {
	       		 	conversationContext = response.context;
								console.log("response.context " + JSON.stringify(response.context, null, 4));
		        	//sendFBMessage (sender, {text:response.output.text[0]});
							 for (l=0;l<response.output.text.length;l++)
                        {
                            if (dataText) dataText = dataText +"\n";
                            dataText = dataText + response.output.text[l];
                        }
                        sendFBMessage (sender, {text:dataText});  
	        	}
				}
				else {
	       		 	conversationContext = response.context;
								console.log("response.context " + JSON.stringify(response.context, null, 4));
		        	//sendFBMessage (sender, {text:response.output.text[0]});
							 for (l=0;l<response.output.text.length;l++)
                        {
                            if (dataText) dataText = dataText +"\n";
                            dataText = dataText + response.output.text[l];
                        }
                        sendFBMessage (sender, {text:dataText});  
	        	}
	        }
	    });
}

function findOrCreateContext (convId){
      // Let's see if we already have a session for the user convId
    if (!contexts)
        contexts = [];
        
    if (!contexts[convId]) {
        // No session found for user convId, let's create a new one
        //with Michelin concervsation workspace by default
        contexts[convId] = {workspaceId: workspaceIdVP, watsonContext: {}};
        //console.log ("new session : " + convId);
    }
return contexts[convId];
}
var host = process.env.VCAP_APP_HOST || "localhost";
var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port, host);