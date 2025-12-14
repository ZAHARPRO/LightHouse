<?php

namespace App\Entity;

use App\Repository\MySubcribersRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MySubcribersRepository::class)]
class mySubcribers
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'my_sub_user')]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $user = null;

    #[ORM\ManyToOne(inversedBy: 'my_subs')]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $my_sub_user = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;

        return $this;
    }

    public function getMySubUser(): ?User
    {
        return $this->my_sub_user;
    }

    public function setMySubUser(?User $my_sub_user): static
    {
        $this->my_sub_user = $my_sub_user;

        return $this;
    }
}
