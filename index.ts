import { Client, TextChannel, Snowflake, Message, Collection } from 'discord.js';
import * as config from './config.json';

const client = new Client({
    partials: [ "MESSAGE" ]
});

let channel: TextChannel = null;
let initialMessageID: Snowflake = null;

const content = 
`**Type the number of the problem you're experiencing and I'll do my best to help you!**

\`1\` - I want to setup the bot (join/leave messages, prefix, etc...)
\`2\` - I want to use the web dashboard
\`3\` - I want to know how to use the bot
\`4\` - ManageInvite says my server needs to be upgraded
\`5\` - My problem is not in the list`;

client.on('ready', () => {
    console.log(`Ready. Logged as ${client.user.tag}.`);
    channel = client.channels.cache.get(config.supportChannel) as TextChannel;
    channel.messages.fetch().then((messages) => {
        initialMessageID = messages.first()?.id;
        if(!initialMessageID){
            channel.send(content)
        }
    });
});

interface MessageData {
    messageID: Snowflake;
    deleteSelf: any;
    deleteUser: any;
}
const relatedMessages: Collection<Snowflake, MessageData> = new Collection();

const sendAndDeleteAfter = (message: Message, content: string) => {
    message.channel.send(content).then((m) => {
        const deleteSelfTimeout = setTimeout(() => m.delete(), 20000);
        const deleteUserTimeout = setTimeout(() => message.delete(), 20000);
        relatedMessages.set(message.id, {
            messageID: m.id,
            deleteSelf: deleteSelfTimeout,
            deleteUser: deleteUserTimeout
        });
    });
};

client.on('messageDelete', (message) => {
    const relatedMessageData = relatedMessages.get(message.id);
    if(relatedMessageData){
        channel.messages.fetch(relatedMessageData.messageID).then((m) => {
            m.delete();
            clearTimeout(relatedMessageData.deleteSelf);
            clearTimeout(relatedMessageData.deleteUser);
            relatedMessages.delete(message.id);
        });
    }
})

client.on('message', (message) => {
    if(message.partial) return;
    if(message.author.bot) return;
    if(message.channel.id === config.supportChannel){
        switch(message.content){
            case "1":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, you can configure join messages, leave messages or join messages in direct messages by using the dashboard: **<https://dash.manage-invite.xyz/>** (recommended) or the \`+configjoin\`, \`+configleave\` and \`+configdmjoin\` commands.`
                );
                break;
            case "2":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, you can access the web dashboard by using this link: **<https://dash.manage-invite.xyz>**.`
                );
                break;
            case "3":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, to get the list of all the commands, you can run the \`+help\` command.\nYou can also type \`1\` to know how to configure the bot!`
                );
                break;
            case "4":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, this is because you didn't buy ManageInvite. Indeed, our services are no longer free, to keep a good speed and uptime for users who really need a stable bot. Nevertheless, we want ManageInvite to remain accessible to all, that's why the price has been lowered from $5 to $2 per month. You want to try the bot? Ask for a 7-day trial period in <#${config.trialTickets}>! It's totally free, just send the link to your server.`,
                );
                break;
            case "5":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, you now have access to the <#${config.contactChannel}> channel. You can click the :envelope: reaction to open a ticket!`
                );
                break;
            default:
                sendAndDeleteAfter(
                    message,
                    `Hello, ${message.author.toString()}, you must type a valid number corresponding to the issue you are experiencing.`
                );
        }
    }
});

client.login(config.token);
