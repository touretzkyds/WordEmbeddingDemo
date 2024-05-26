fig2

w_grandmother =  {9, 9, 'grandmother'};
w_grandparent =  {5, 9, 'grandparent'};
w_octogenarian = {5, 10, 'octogenarian'};
w_teenager =     {5, 4, 'teenager'};

light_blue = [0.4, 0.7, 1.0];

dot2(w_grandmother, [], light_blue)
dot2(w_grandparent, [], light_blue)
dot2(w_octogenarian, [0.25, 0.1], light_blue)
dot2(w_teenager, [], light_blue)

savefigure("fig2ans.png")
